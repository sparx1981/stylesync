'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const GH_REPO = 'sparx1981/stylesync';

const btn =
    'rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-50';

export function SourceActions({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | undefined>();
    const [urlValue, setUrlValue] = useState('');

  async function trigger(full: boolean) {
        setMessage(undefined);
        const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: sourceId, full }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        setMessage(res.ok ? 'Sync dispatched -- check GitHub Actions for progress.' : (data.error ?? `Request failed (${res.status})`));
  }

  async function captureUrl() {
        if (!urlValue.trim()) return;
        setMessage(undefined);
        const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlValue.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (res.ok) {
                setMessage('Capture dispatched -- check GitHub Actions for progress.');
                setUrlValue('');
        } else {
                setMessage(data.error ?? `Request failed (${res.status})`);
        }
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

  // The "url" source has no listing of its own to (re)sync -- every capture
  // is a fresh ad-hoc page, so it gets a URL box + "Capture" button here
  // instead of the standard Sync now / Full re-sync pair.
  if (sourceId === 'url') {
        return (
                <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                                  <input
                                                type="url"
                                                inputMode="url"
                                                placeholder="https://example.com/page"
                                                value={urlValue}
                                                onChange={(e) => setUrlValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                                if (e.key === 'Enter') captureUrl();
                                                }}
                                                className="w-64 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)]"
                                              />
                                  <button type="button" className={btn} disabled={isPending || !urlValue.trim()} onClick={captureUrl}>
                                              Capture
                                  </button>button>
                                  <a
                                                href={`https://github.com/${GH_REPO}/actions/workflows/sync.yml`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={btn}
                                              >
                                              View log
                                  </a>a>
                        </div>div>
                  {message && <p className="max-w-xs text-right text-xs text-[var(--color-fg-subtle)]">{message}</p>p>}
                </div>div>
              );
  }
  
    return (
          <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                        <button type="button" className={btn} disabled={isPending} onClick={() => trigger(false)}>
                                  Sync now
                        </button>button>
                        <button type="button" className={btn} disabled={isPending} onClick={() => trigger(true)}>
                                  Full re-sync
                        </button>button>
                        <a
                                    href={`https://github.com/${GH_REPO}/actions/workflows/sync.yml`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={btn}
                                  >
                                  View log
                        </a>a>
                        <button type="button" className={btn} disabled={isPending} onClick={togglePause}>
                          {enabled ? 'Pause' : 'Resume'}
                        </button>button>
                </div>div>
            {message && <p className="max-w-xs text-right text-xs text-[var(--color-fg-subtle)]">{message}</p>p>}
          </div>div>
        );
}
</div>
