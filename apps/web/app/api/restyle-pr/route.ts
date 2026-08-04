import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
// Imported from its own subpath, not the `@stylesync/core` root barrel --
// the barrel also re-exports `codemods/verify.js`, which pulls in
// Playwright (used for `takeShots`/`runAxeCheck`), and Playwright has no
// business being bundled into a Vercel serverless function. Same reasoning
// as the Sources page's `@stylesync/core/sources` subpath import.
import { openRestylePr } from '@stylesync/core/github/restylePr';
import type { DRP } from '@stylesync/core';

export const dynamic = 'force-dynamic';
// A zipball download + codemod pass + several GitHub API round trips can
// comfortably exceed the default 10s Vercel function timeout on a
// medium-sized repo — this needs the longer ceiling available on the
// Fluid Compute / Pro execution model.
export const maxDuration = 60;

interface RestylePrRequestBody {
  refId?: string;
  repo?: string; // "owner/repo"
  token?: string;
  baseBranch?: string;
}

// Triggers the "Restyle via PR" feature: applies the deterministic restyle
// pass (see packages/core/src/github/restylePr.ts) against a GitHub repo the
// caller supplies, and opens a pull request with the result. The GitHub
// token is supplied by the person using this form, used only for this one
// request to call the GitHub API on their behalf, and is never written to
// the database or logged — there is nothing to clean up afterwards.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RestylePrRequestBody;

  const refId = body.refId?.trim();
  const repoFullName = body.repo?.trim();
  const token = body.token?.trim();
  const baseBranch = body.baseBranch?.trim() || undefined;

  if (!refId) return NextResponse.json({ error: 'Missing refId.' }, { status: 400 });
  if (!token) return NextResponse.json({ error: 'A GitHub token is required.' }, { status: 400 });
  if (!repoFullName || !repoFullName.includes('/')) {
    return NextResponse.json({ error: 'repo must be in "owner/repo" form.' }, { status: 400 });
  }
  const [owner, repo] = repoFullName.split('/', 2);

  const db = getDb();
  const ref = await db.getRef(refId);
  if (!ref) return NextResponse.json({ error: `No reference "${refId}".` }, { status: 404 });

  const drpRow = await db.getDrp(refId);
  if (!drpRow) return NextResponse.json({ error: `No DRP built yet for "${refId}" — run a sync first.` }, { status: 404 });
  const drp = JSON.parse(drpRow.profile) as DRP;

  try {
    const result = await openRestylePr({ owner, repo, token, refId, drp, baseBranch });
    if (result.noChanges) {
      return NextResponse.json({ noChanges: true, message: 'The deterministic codemod pass found nothing to change in this repo for this style.' });
    }
    return NextResponse.json({ prUrl: result.prUrl, branchName: result.branchName, baseBranch: result.baseBranch, filesChanged: result.filesChanged });
  } catch (err) {
    // Deliberately generic-ish: the underlying error may echo back
    // repo/branch details from GitHub's API, which is fine, but never echo
    // the token itself (it never appears in these error messages, since
    // openRestylePr only puts it in an Authorization header).
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
