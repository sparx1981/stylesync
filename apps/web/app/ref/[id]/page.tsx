import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { DrpTabs } from '../../../components/DrpTabs';
import { CopyPackCommand } from '../../../components/CopyPackCommand';
import type { DRP } from '@stylesync/core';

export const dynamic = 'force-dynamic';

export default async function ReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const ref = await db.getRef(id);
  if (!ref) notFound();

  const drpRow = await db.getDrp(id);
  const drp: DRP | undefined = drpRow ? JSON.parse(drpRow.profile) : undefined;
  const assets = await db.listAssets(id);
  const hasScreenshot = assets.some((a) => a.kind === 'screenshot');

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Left: visual gallery */}
      <div>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {hasScreenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/asset/${id}/screenshot`} alt={ref.title ?? id} className="w-full" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-[var(--color-fg-subtle)]">No screenshot captured</div>
          )}
        </div>
        <h1 className="mt-4 text-lg font-medium">{ref.title ?? '(untitled)'}</h1>
        <p className="font-mono-token text-xs text-[var(--color-fg-subtle)]">{ref.origin_url}</p>
        <div className="mt-4">
          <CopyPackCommand refId={id} />
        </div>
      </div>

      {/* Right: extracted design system, tabbed */}
      <div>{drp ? <DrpTabs drp={drp} /> : <p className="text-sm text-[var(--color-fg-muted)]">No DRP built yet for this reference — run `stylesync sync` again, or check `stylesync doctor`.</p>}</div>
    </div>
  );
}
