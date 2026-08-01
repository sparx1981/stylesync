import { Fragment } from 'react';
import { getDb } from '../../lib/db';
import { loadAllSourceConfigs } from '@stylesync/core/sources';
import { SourceActions } from '../../components/SourceActions';

export const dynamic = 'force-dynamic';

const GH_REPO = 'sparx1981/stylesync';

// Where to get each token a source might need, and a link straight to
// where it actually gets used (GitHub Actions secrets — the sync worker,
// not this website, is what reads these). Extend this alongside a source's
// `requires_env` in config/sources/*.yaml when adding a new gated source.
const ENV_SETUP_INFO: Record<string, { getUrl: string; getLabel: string }> = {
  FIGMA_TOKEN: {
    getUrl: 'https://www.figma.com/developers/api#access-tokens',
    getLabel: 'Get a Figma personal access token',
  },
  ANTHROPIC_API_KEY: {
    getUrl: 'https://console.anthropic.com/settings/keys',
    getLabel: 'Get a Claude API key',
  },
};

export default async function SourcesPage() {
  const db = getDb();
  // Reads config/sources/*.yaml directly — pure metadata, no dependency on the
  // adapter implementations (which pull in Playwright and have no business
  // being part of a web server bundle; see packages/core's "./sources" export).
  const sourceConfigs = loadAllSourceConfigs();
  const runs = await db.listSyncRuns();

  const rows = await Promise.all(
    sourceConfigs.map(async (cfg) => {
      const row = await db.getSource(cfg.id);
      const health = row?.health ? (JSON.parse(row.health) as { ok: boolean; message: string }) : undefined;
      const refs = await db.listRefs({ source: cfg.id });
      const confidences = (await Promise.all(refs.map((r) => db.getDrp(r.id))))
        .map((d) => d?.confidence)
        .filter((c): c is number => typeof c === 'number');
      const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined;
      return { cfg, row, health, refsCount: refs.length, avgConfidence };
    })
  );

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
            <th className="py-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cfg, row, health, refsCount, avgConfidence }) => {
            const requiresEnv = (cfg.requires_env as string[] | undefined) ?? [];
            const needsSetup = requiresEnv.length > 0 && !health?.ok;
            return (
            <Fragment key={cfg.id}>
            <tr className="border-b border-[var(--color-border)]">
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
              <td className="py-3 font-mono-token">{refsCount}</td>
              <td className="py-3 font-mono-token text-[var(--color-fg-muted)]">{row?.last_sync_at ? new Date(row.last_sync_at).toLocaleString() : '—'}</td>
              <td className="py-3 font-mono-token">{avgConfidence !== undefined ? avgConfidence.toFixed(2) : '—'}</td>
              <td className="py-3 text-right">
                <SourceActions sourceId={cfg.id} enabled={row ? row.enabled !== 0 : true} />
              </td>
            </tr>
            {needsSetup && (
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-raised)]">
                <td colSpan={6} className="px-2 py-2 text-xs text-[var(--color-fg-muted)]">
                  Needs setup —{' '}
                  {requiresEnv.map((envVar, i) => (
                    <span key={envVar}>
                      {i > 0 && ', '}
                      <code className="font-mono-token">{envVar}</code>
                      {ENV_SETUP_INFO[envVar] && (
                        <>
                          {' '}
                          (
                          <a
                            href={ENV_SETUP_INFO[envVar].getUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-[var(--color-fg)]"
                          >
                            {ENV_SETUP_INFO[envVar].getLabel}
                          </a>
                          )
                        </>
                      )}
                    </span>
                  ))}
                  {' '}— then add it as a repo secret at{' '}
                  <a
                    href={`https://github.com/${GH_REPO}/settings/secrets/actions`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[var(--color-fg)]"
                  >
                    github.com/{GH_REPO}/settings/secrets/actions
                  </a>
                  .
                </td>
              </tr>
            )}
            </Fragment>
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
