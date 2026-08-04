'use client';

import { useState } from 'react';

interface RestylePrResult {
  prUrl?: string;
  branchName?: string;
  baseBranch?: string;
  filesChanged?: string[];
  noChanges?: boolean;
  message?: string;
  error?: string;
}

export function RestylePrForm({ refId }: { refId: string }) {
  const [open, setOpen] = useState(false);
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RestylePrResult | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(undefined);
    try {
      const res = await fetch('/api/restyle-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refId, repo, token, baseBranch: baseBranch || undefined }),
      });
      const data = (await res.json()) as RestylePrResult;
      setResult(data);
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono-token rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
      >
        ⇄ Restyle a repo (PR)
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Restyle a repo via pull request</span>
        <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]">
          ✕
        </button>
      </div>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Applies the deterministic token-substitution pass (colours, radius, shadow, spacing, motion — not component-level layout) to a GitHub repo you own, and opens a PR with the result.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-fg-muted)]">Repo (owner/name)</span>
        <input
          required
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="your-org/your-app"
          className="font-mono-token rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-fg-muted)]">GitHub token (fine-grained PAT, Contents + Pull requests: write)</span>
        <input
          required
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
          className="font-mono-token rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-fg-muted)]">Base branch (optional — defaults to the repo's default branch)</span>
        <input
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
          placeholder="main"
          className="font-mono-token rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-2 py-1.5"
        />
      </label>

      <p className="text-xs text-[var(--color-fg-subtle)]">
        This token is sent to our server for this one request only, used to call the GitHub API on your behalf, and is never stored or logged.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-raised)] px-3 py-2 font-medium text-[var(--color-fg)] hover:border-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? 'Working…' : 'Open PR'}
      </button>

      {result && (
        <div className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 text-xs">
          {result.error && <p className="text-[var(--color-danger)]">{result.error}</p>}
          {result.noChanges && <p className="text-[var(--color-fg-muted)]">{result.message ?? 'Nothing to change.'}</p>}
          {result.prUrl && (
            <p>
              ✔ Opened{' '}
              <a href={result.prUrl} target="_blank" rel="noreferrer" className="underline">
                {result.prUrl}
              </a>
              <br />
              {result.filesChanged?.length ?? 0} file(s) changed on <code className="font-mono-token">{result.branchName}</code>.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
