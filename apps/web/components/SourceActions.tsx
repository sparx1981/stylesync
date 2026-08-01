'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const GH_REPO = 'sparx1981/stylesync';

export function SourceActions({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();

  async function trigger(full: boolean) {
    setMessage(undefined);
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceId, full }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setMessage(res.ok ? 'Sync dispatched — check GitHub Actions for progress.' : (data.error ?? `Request failed (${res.status})`));
  }

  async function togglePause() {
    setMessage(undefined);
    const res = await fetch(`/api/sources/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? `Request failed (${res.status})`);
    }
  }

  const btn =
    'rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-50';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={isPending} onClick={() => trigger(false)}>
          Sync now
        </button>
        <button type="button" className={btn} disabled={isPending} onClick={() => trigger(true)}>
          Full re-sync
        </button>
        <a
          href={`https://github.com/${GH_REPO}/actions/workflows/sync.yml`}
          target="_blank"
          rel="noreferrer"
          className={btn}
        >
          View log
        </a>
        <button type="button" className={btn} disabled={isPending} onClick={togglePause}>
          {enabled ? 'Pause' : 'Resume'}
        </button>
      </div>
      {message && <p className="max-w-xs text-right text-xs text-[var(--color-fg-subtle)]">{message}</p>}
    </div>
  );
}
