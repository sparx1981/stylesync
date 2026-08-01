import type { DRP } from '@stylesync/core';

export function PaletteStrip({ palette }: { palette: DRP['color']['palette'] }) {
  const swatches = Object.entries(palette)
    .filter(([, ramp]) => !!ramp)
    .slice(0, 5);
  return (
    <div className="flex h-5 overflow-hidden rounded-[var(--radius-sm)] ring-1 ring-[var(--color-border)]">
      {swatches.map(([role, ramp]) => (
        <div key={role} className="flex-1" style={{ background: ramp!.base }} title={`${role}: ${ramp!.base}`} />
      ))}
    </div>
  );
}
