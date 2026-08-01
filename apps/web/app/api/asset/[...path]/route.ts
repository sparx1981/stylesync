import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { StyleSyncDB } from '@stylesync/core/db';

/**
 * Serves reference assets (screenshot/thumb) straight off disk from data/refs/.
 * Not a static /public path because refs are added dynamically by `stylesync
 * sync` — this route resolves ref_id -> asset path via the DB rather than
 * assuming a fixed filesystem layout the UI has to know about.
 *
 * This only works against the local SQLite backend (StyleSyncDB), where
 * `data/refs/*` lives on the same disk as the running server. Hosted
 * (Postgres-backed) deployments have no local disk to serve captured
 * screenshots from — that needs real object storage (e.g. Vercel Blob),
 * which isn't wired up yet.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const [refId, kind] = (await params).path;
    if (!refId || !kind) return NextResponse.json({ error: 'expected /api/asset/<ref_id>/<kind>' }, { status: 400 });

  const db = getDb();
    const assets = await db.listAssets(refId);
    const asset = assets.find((a) => a.kind === kind);
    if (!asset) return NextResponse.json({ error: `no ${kind} asset for ${refId}` }, { status: 404 });

  if (!(db instanceof StyleSyncDB)) {
        return NextResponse.json(
          { error: 'asset storage not configured for hosted deployments yet (needs object storage, e.g. Vercel Blob)' },
          { status: 501 }
              );
  }

  const fullPath = join(db.dataDir, asset.path);
    if (!existsSync(fullPath)) return NextResponse.json({ error: 'asset file missing on disk' }, { status: 404 });

  const bytes = readFileSync(fullPath);
    return new NextResponse(bytes, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' } });
}
