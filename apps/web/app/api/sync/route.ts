import { NextRequest, NextResponse } from 'next/server';

/**
 * Triggers the GitHub Actions sync worker (.github/workflows/sync.yml) via
 * GitHub's REST API, since Playwright can't run inside this Vercel
 * serverless function. Requires two env vars set on the Vercel project
 * (added manually, never entered by an agent — same policy as the Neon/Blob
 * tokens):
 *   GH_DISPATCH_TOKEN — a fine-grained GitHub PAT scoped to this repo with
 *     "Actions: Read and write" permission.
 *   GH_REPO — "owner/repo", e.g. "sparx1981/stylesync".
 *
 * Body is either { source, full } to (re)sync a registered source, or
 * { url } to capture a single ad-hoc reference via the "url" adapter (used
 * by the "Add a reference by URL" box on the Sources page).
 */
export async function POST(req: NextRequest) {
  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GH_REPO;
  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GH_DISPATCH_TOKEN and/or GH_REPO env vars are not set on this deployment — sync trigger is not configured yet.' },
      { status: 501 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { source?: string; full?: boolean; url?: string };

  let url = '';
  if (body.url) {
    try {
      const parsed = new URL(body.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('not http(s)');
      url = parsed.toString();
    } catch {
      return NextResponse.json({ error: 'That doesn\'t look like a valid http(s) URL.' }, { status: 400 });
    }
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sync.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        source: url ? '' : (body.source ?? ''),
        full: body.full ? 'true' : 'false',
        url,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ error: `GitHub API returned ${res.status}: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
