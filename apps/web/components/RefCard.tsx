import Link from 'next/link';
import type { DRP, RefRow } from '@stylesync/core';
import { ConfidenceDot } from './ConfidenceDot';
import { PaletteStrip } from './PaletteStrip';

export function RefCard({ ref, drp }: { ref: RefRow; drp?: DRP }) {
  return (
    <Link
      href={`/ref/${ref.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-emphasis)]"
    >
      <div className="aspect-video w-full overflow-hidden bg-[var(--color-raised)]">
        <img
          src={`/api/asset/${ref.id}/thumb`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-90 transition-opacity group-hover:opacity-100"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-fg)]">{ref.title ?? '(untitled)'}</span>
          {drp && <ConfidenceDot confidence={drp.provenance.confidence} />}
        </div>
        <span className="font-mono-token truncate text-xs text-[var(--color-fg-subtle)]">{ref.source_id}</span>
        {drp && <PaletteStrip palette={drp.color.palette} />}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(ref.id);
          }}
          className="font-mono-token mt-1 w-fit rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
        >
          {ref.id} · copy
        </button>
      </div>
    </Link>
  );
}
