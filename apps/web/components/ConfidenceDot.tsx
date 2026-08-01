export function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 0.85 ? 'var(--color-success)' : confidence >= 0.6 ? 'var(--color-warning)' : 'var(--color-danger)';
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono-token text-xs text-[var(--color-fg-subtle)]"
      title={`Extraction confidence ${confidence.toFixed(2)}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {confidence.toFixed(2)}
    </span>
  );
}
