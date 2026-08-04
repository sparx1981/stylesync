import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { StyleSyncDB } from '@stylesync/core/db';
// Imported from its own subpath, not the `@stylesync/core` root barrel --
// the barrel also re-exports `codemods/verify.js`, which pulls in
// Playwright (used for `takeShots`/`runAxeCheck`) and breaks `next build`
// with unresolvable optional Playwright subdependencies once anything from
// this route bundle reaches that file. Same reasoning as the Sources page's
// `@stylesync/core/sources` subpath import.
import { renderBrandGuidePdf } from '@stylesync/core/brandguide/renderBrandGuidePdf';
import type { DRP } from '@stylesync/core';

export const dynamic = 'force-dynamic';

// Generates a "Brand Guidelines" PDF on demand from a reference's DRP.
// Deliberately generated fresh on every request rather than pre-built and
// stored: pdfkit draws the document directly from data already sitting in
// Postgres, so there's nothing to cache in Blob storage and no Claude API
// call involved — this works exactly the same whether or not either of
// those is currently available.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const ref = await db.getRef(id);
  if (!ref) return NextResponse.json({ error: `no reference "${id}"` }, { status: 404 });

  const drpRow = await db.getDrp(id);
  if (!drpRow) return NextResponse.json({ error: `no DRP built yet for "${id}" — run a sync first` }, { status: 404 });
  const drp = JSON.parse(drpRow.profile) as DRP;

  let screenshotPng: Buffer | undefined;
  try {
    const assets = await db.listAssets(id);
    const screenshotAsset = assets.find((a) => a.kind === 'screenshot');
    if (screenshotAsset) {
      if (screenshotAsset.path.startsWith('http://') || screenshotAsset.path.startsWith('https://')) {
        const res = await fetch(screenshotAsset.path);
        if (res.ok) screenshotPng = Buffer.from(await res.arrayBuffer());
      } else if (db instanceof StyleSyncDB) {
        const fullPath = join(db.dataDir, screenshotAsset.path);
        if (existsSync(fullPath)) screenshotPng = readFileSync(fullPath);
      }
    }
  } catch {
    // The cover image is a nice-to-have — a Blob outage or a missing local
    // file shouldn't fail the whole document, just ship without it.
  }

  const pdf = await renderBrandGuidePdf(drp, { screenshotPng });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${id}-brand-guide.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
