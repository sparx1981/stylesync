import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

/**
 * Toggles a source's enabled/paused state (spec §11.3's "pause" action).
 * A paused source is skipped by the GitHub Actions worker's scheduled
 * (no --source) runs, but can still be synced on demand via "Sync now".
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'expected JSON body { "enabled": boolean }' }, { status: 400 });
  }

  const db = getDb();
  await db.setSourceEnabled(id, body.enabled);
  return NextResponse.json({ ok: true, id, enabled: body.enabled });
}
