import { getDb } from '../../lib/db';
import { loadAllSourceConfigs } from '@stylesync/core/sources';

export const dynamic = 'force-dynamic';

export default async function SourcesPage() {
  const db = getDb();
  // Reads config/sources/*.yaml directly — pure metadata, no dependency on the
  // adapter implementations (which pull in Playwright and have no business
  // being part of a web server bundle; see packages/core's "./sources" export).
  const sourceConfigs = loadAllSourceConfigs();
  const runs = db.listSyncRuns();

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="mb-6 text-lg font-medium">Sources</h1>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-fg-subtle)]">
            <th className="py-2 font-normal">Source</th>
            <th className="py-2 font-normal">Status</th>
            <th className="py-2 font-normal">Indexed</th>
            <th className="py-2 font-normal">Last sync</th>
            <th className="py-2 font-normal">Confidence avg</th>
          </tr>
        </thead>
        <tbody>
          {sourceConfigs.map((cfg) => {
            const row = db.getSource(cfg.id);
            const health = row?.health ? (JSON.parse(row.health) as { ok: boolean; message: string }) : undefined;
            const refs = db.listRefs({ source: cfg.id });
            const confidences = refs
              .map((r) => db.getDrp(r.id)?.confidence)
              .filter((c): c is number => typeof c === 'number');
            const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined;

            return (
              <tr key={cfg.id} className="border-b border-[var(--color-border)]">
                <td className="py-3">
                  <div className="font-medium">{cfg.display_name}</div>
                  <div className="font-mono-token text-xs text-[var(--color-fg-subtle)]">{cfg.id} · {cfg.access_method}</div>
                </td>
                <td className="py-3">
                  {!row ? (
                    <span className="text-[var(--color-fg-subtle)]">never synced</span>
                  ) : health?.ok ? (
                    <span className="text-[var(--color-success)]">● healthy</span>
                  ) : (
                    <span className="text-[var(--color-danger)]" title={health?.message}>
                      ● unhealthy
                    </span>
                  )}
                </td>
                <td className="py-3 font-mono-token">{refs.length}</td>
                <td className="py-3 font-mono-token text-[var(--color-fg-muted)]">{row?.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : '—'}</td>
                <td className="py-3 font-mono-token">{avgConfidence !== undefined ? avgConfidence.toFixed(2) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2 className="mb-3 mt-10 text-sm font-medium text-[var(--color-fg-muted)]">Recent sync runs</h2>
      <div className="flex flex-col gap-2 text-sm">
        {runs.length === 0 && <p className="text-[var(--color-fg-subtle)]">None yet — run `stylesync sync` from the terminal.</p>}
        {runs.slice(0, 20).map((run) => (
          <div key={run.id} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2">
            <span className="font-mono-token">{run.source_id}</span>
            <span className="font-mono-token text-xs text-[var(--color-fg-muted)]">
              +{run.added} ~{run.updated} ={run.unchanged} !{run.failed}
            </span>
            <span className="font-mono-token text-xs text-[var(--color-fg-subtle)]">{new Date(run.started_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
