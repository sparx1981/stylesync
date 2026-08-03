'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DRP, RefRow } from '@stylesync/core';
import { ConfidenceDot } from './ConfidenceDot';
import { PaletteStrip } from './PaletteStrip';

export function RefCard({ refItem, drp }: { refItem: RefRow; drp?: DRP }) {
  return (
    <Link
      href={`/ref/${refItem.id}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-emphasis)]"
    >
      <div className="aspect-video w-full overflow-hidden bg-[var(--color-raised)]">
        <img
          src={`/api/asset/${refItem.id}/thumb`}
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
          <span className="truncate text-sm font-medium text-[var(--color-fg)]">{refItem.title ?? '(untitled)'}</span>
          {drp && <ConfidenceDot confidence={drp.provenance.confidence} />}
        </div>
        <span className="font-mono-token truncate text-xs text-[var(--color-fg-subtle)]">{refItem.source_id}</span>
        {drp && <PaletteStrip palette={drp.color.palette} />}
        <CopyRefIdButton refId={refItem.id} />
      </div>
    </Link>
  );
}

// Used with `stylesync pack <ref_id>` from the CLI to generate a style pack
// from this reference -- shown as a short labelled action (with a tooltip
// explaining why you'd want it) rather than the raw id, which just read as
// unexplained clutter under every card.
function CopyRefIdButton({ refId }: { refId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard?.writeText(refId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={`Copy this reference's ID -- use it with \`stylesync pack ${refId}\` to generate a style pack from the CLI`}
      className="font-mono-token mt-1 flex w-fit items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
    >
      {copied ? '✔ copied' : 'Copy ref ID'}
    </button>
  );
}
