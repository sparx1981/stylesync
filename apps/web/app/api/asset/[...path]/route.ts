import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { StyleSyncDB } from '@stylesync/core/db';

/**
 * Serves reference assets (screenshot/thumb/video). Not a static /public path
 * because refs are added dynamically by `stylesync sync` — this route
 * resolves ref_id -> asset path via the DB rather than assuming a fixed
 * filesystem layout the UI has to know about.
 *
 * Two storage backends are supported, matching saveAssetBytes in
 * packages/core/src/sync.ts:
 *  - Vercel Blob: `asset.path` is a full https:// URL — redirect straight to it.
 *  - Local disk (SQLite/CLI dev only): `asset.path` is relative to db.dataDir.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
        const [refId, kind] = (await params).path;
        if (!refId || !kind) return NextResponse.json({ error: 'expected /api/asset/<ref_id>/<kind>' }, { status: 400 });

  const db = getDb();
        const assets = await db.listAssets(refId);
        const asset = assets.find((a) => a.kind === kind);
        if (!asset) return NextResponse.json({ error: `no ${kind} asset for ${refId}` }, { status: 404 });

  // Assets captured by the GitHub Actions worker against a hosted Postgres
  // backend are saved to Vercel Blob (see saveAssetBytes in packages/core/
  // src/sync.ts), which stores the full https:// Blob URL in `asset.path`
  // rather than a local-disk-relative path. Redirect straight to it instead
  // of falling through to the SQLite-only disk-read path below, which would
  // otherwise 501 on every hosted request regardless of whether Blob is
  // actually configured and working.
  if (asset.path.startsWith('http://') || asset.path.startsWith('https://')) {
          return NextResponse.redirect(asset.path, { status: 307 });
  }

  if (!(db instanceof StyleSyncDB)) {
              return NextResponse.json(
                  { error: 'asset storage not configured for hosted deployments yet (needs object storage, e.g. Vercel Blob)' },
                  { status: 501 }
                                );
  }

  const fullPath = join(db.dataDir, asset.path);
        if (!existsSync(fullPath)) return NextResponse.json({ error: 'asset file missing on disk' }, { status: 404 });

  const bytes = readFileSync(fullPath);
        const contentType = kind === 'video' ? 'video/webm' : 'image/png';
        return new NextResponse(bytes, { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' } });
}
