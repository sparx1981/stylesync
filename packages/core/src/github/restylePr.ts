import AdmZip from 'adm-zip';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { DRP } from '../drp/types.js';
import { applyDeterministic } from '../codemods/apply.js';

export interface OpenRestylePrOptions {
  owner: string;
  repo: string;
  /** A GitHub PAT (fine-grained, scoped to this repo, "Contents" + "Pull requests" write) supplied by the caller for this one request only — never persisted or logged. */
  token: string;
  refId: string;
  drp: DRP;
  baseBranch?: string;
  branchName?: string;
}

export interface OpenRestylePrResult {
  prUrl?: string;
  branchName: string;
  baseBranch: string;
  filesChanged: string[];
  noChanges: boolean;
}

const GITHUB_API = 'https://api.github.com';

/**
 * Applies the deterministic restyle pass (`applyDeterministic`, ~70% of a
 * full restyle — token substitution, not component-level redesign) against
 * a target GitHub repo, entirely server-side: download the repo as a
 * zipball via the GitHub API, run the existing codemods against the
 * extracted files in a temp dir (same function the CLI's `stylesync apply`
 * uses, with `force: true` since a zipball has no .git history to serve as
 * the usual git-based rollback net), then commit the changed files and open
 * a PR via the Git Data API. No Vercel Blob, no Claude API, no local git
 * checkout of the target repo required — only the GitHub REST API and a
 * temp directory that's discarded when the request finishes.
 */
export async function openRestylePr(opts: OpenRestylePrOptions): Promise<OpenRestylePrResult> {
  const { owner, repo, token, refId, drp } = opts;

  const baseBranch = opts.baseBranch ?? (await getDefaultBranch(owner, repo, token));
  const baseRef = await ghFetch<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, token);
  const baseCommitSha = baseRef.object.sha;
  const baseCommit = await ghFetch<{ tree: { sha: string } }>(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = baseCommit.tree.sha;

  const tmpDir = mkdtempSync(join(tmpdir(), 'stylesync-restyle-'));
  try {
    await extractZipball(owner, repo, baseBranch, token, tmpDir);

    const result = applyDeterministic({ projectPath: tmpDir, drp, force: true });
    if (result.aborted) {
      throw new Error(`Deterministic restyle aborted partway through: ${result.aborted}`);
    }

    // applyDeterministic always writes .stylesync/tokens.css even when
    // nothing else in the project needed changing — that alone isn't worth
    // opening a PR for, so "no changes" means nothing beyond the token file.
    const meaningfulChanges = result.filesChanged.filter((f) => f !== join('.stylesync', 'tokens.css').replace(/\\/g, '/') && !f.startsWith('.stylesync/'));
    const filesToCommit = meaningfulChanges.length > 0 ? result.filesChanged : [];

    if (filesToCommit.length === 0) {
      return { branchName: opts.branchName ?? '', baseBranch, filesChanged: [], noChanges: true };
    }

    const branchName = opts.branchName ?? `stylesync/restyle-${refId}-${Date.now()}`;

    const treeEntries = filesToCommit.map((relPath) => {
      const content = readFileSync(join(tmpDir, relPath), 'utf-8');
      return { path: relPath.replace(/\\/g, '/'), content };
    });

    const blobs = await Promise.all(
      treeEntries.map(async (entry) => {
        const blob = await ghFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, token, {
          method: 'POST',
          body: JSON.stringify({ content: entry.content, encoding: 'utf-8' }),
        });
        return { path: entry.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha };
      })
    );

    const newTree = await ghFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: blobs }),
    });

    const commitMessage = `stylesync: apply deterministic restyle from ${refId}\n\nRun via the StyleSync "Restyle via PR" feature. This covers the deterministic ~70% of a restyle (colour/radius/shadow/spacing/motion token substitution) — component-level layout and structural changes are out of scope for an automated PR and are handled separately by the interactive restyle skill.`;
    const newCommit = await ghFetch<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({ message: commitMessage, tree: newTree.sha, parents: [baseCommitSha] }),
    });

    await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: newCommit.sha }),
    });

    const pr = await ghFetch<{ html_url: string }>(`/repos/${owner}/${repo}/pulls`, token, {
      method: 'POST',
      body: JSON.stringify({
        title: `Restyle with ${refId} (via StyleSync)`,
        head: branchName,
        base: baseBranch,
        body: buildPrBody(refId, drp, filesToCommit),
      }),
    });

    return { prUrl: pr.html_url, branchName, baseBranch, filesChanged: filesToCommit, noChanges: false };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function getDefaultBranch(owner: string, repo: string, token: string): Promise<string> {
  const info = await ghFetch<{ default_branch: string }>(`/repos/${owner}/${repo}`, token);
  return info.default_branch;
}

/**
 * Downloads `GET /repos/{owner}/{repo}/zipball/{ref}` (fetch follows the
 * redirect to codeload.github.com automatically) and extracts it into
 * `destDir`. GitHub wraps the archive contents in a single top-level
 * `{repo}-{shortsha}/` folder, which is stripped off during extraction so
 * `destDir` ends up looking like a normal checked-out project root.
 */
async function extractZipball(owner: string, repo: string, ref: string, token: string, destDir: string): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/zipball/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download repo archive (${res.status}): ${text}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (entries.length === 0) throw new Error('Downloaded repo archive was empty.');

  const rootPrefix = entries[0].entryName.split('/')[0] + '/';
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const relPath = entry.entryName.startsWith(rootPrefix) ? entry.entryName.slice(rootPrefix.length) : entry.entryName;
    if (!relPath) continue;
    zip.extractEntryTo(entry, destDir, false, true, false, relPath);
  }
}

function buildPrBody(refId: string, drp: DRP, filesChanged: string[]): string {
  const lines = [
    `Applies the deterministic style token substitution pass from **${refId}** (${drp.identity.name}).`,
    '',
    `Source confidence: ${drp.provenance.confidence.toFixed(2)} (\`${drp.provenance.extraction_method}\`)`,
    '',
    '### What this covers',
    'Colour literals mapped to the nearest palette token, border-radius/box-shadow/spacing snapped to the nearest scale value, transition durations aligned, and generated `.stylesync/tokens.css` wired in. This is the deterministic ~70% of a restyle.',
    '',
    '### What this does *not* cover',
    'Component-level layout changes, structural polish, and anything requiring visual judgement — that last mile needs the interactive Claude Code restyle skill working in a live project with a running dev server, and is out of scope for a stateless automated PR.',
    '',
    `### Files changed (${filesChanged.length})`,
    ...filesChanged.map((f) => `- \`${f}\``),
  ];
  return lines.join('\n');
}

async function ghFetch<T = unknown>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} returned ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
