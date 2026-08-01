import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB, getDb, syncSource, listAdapters } from '@stylesync/core';

export function registerSyncCommand(program: Command) {
  program
    .command('sync')
    .description('Delta-sync sources')
    .option('--source <id>', 'sync only this source')
    .option('--full', 'full re-sync, ignoring content-hash short-circuiting')
    .option('--add <url>', 'ad-hoc URL to capture via the "url" adapter (implies --source url)')
    .action(async (opts: { source?: string; full?: boolean; add?: string }) => {
      // getDb() picks StyleSyncPostgresDB when POSTGRES_URL is set (e.g. when
      // this command runs inside the GitHub Actions worker against
      // production) and StyleSyncDB (local SQLite) otherwise — same
      // selection logic the web app uses.
      const db = getDb();
      let targets = opts.add ? ['url'] : opts.source ? [opts.source] : listAdapters().map((a) => a.id);

      if (!opts.add && !opts.source) {
        // Scheduled (no explicit --source) runs respect the per-source
        // "paused" toggle set from the web app's Sources page — an explicit
        // --source still forces a sync even if paused, same as "Sync now"
        // on a paused row would.
        const rows = await db.listSources();
        const disabled = new Set(rows.filter((r) => r.enabled === 0).map((r) => r.id));
        targets = targets.filter((id) => !disabled.has(id));
      }

      for (const sourceId of targets) {
        console.log(pc.bold(`\n▸ syncing ${sourceId}${opts.full ? ' (full)' : ''}`));
        try {
          const stats = await syncSource(
            db,
            { sourceId, full: opts.full, urls: opts.add ? [opts.add] : undefined, trigger: process.env.GITHUB_ACTIONS ? 'github-actions' : 'cli' },
            (msg) => console.log(pc.dim(`  ${msg}`))
          );
          console.log(
            `  ${pc.green(`+${stats.added}`)} added, ${pc.yellow(`~${stats.updated}`)} updated, ` +
              `${pc.dim(`=${stats.unchanged}`)} unchanged, ${stats.failed > 0 ? pc.red(`!${stats.failed}`) : `${stats.failed}`} failed ` +
              `(discovered ${stats.discovered})`
          );
        } catch (err) {
          console.error(pc.red(`  sync failed: ${(err as Error).message}`));
        }
      }
      if (db instanceof StyleSyncDB) db.close();
    });
}
