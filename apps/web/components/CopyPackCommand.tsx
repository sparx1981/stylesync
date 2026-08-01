'use client';

import { useState } from 'react';

export function CopyPackCommand({ refId }: { refId: string }) {
  const [copied, setCopied] = useState(false);
  const command = `stylesync pack ${refId}`;

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard?.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono-token rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)]"
    >
      {copied ? '✔ copied' : `$ ${command}`}
    </button>
  );
}
