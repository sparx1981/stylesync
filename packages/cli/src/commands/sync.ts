import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB, syncSource, listAdapters } from '@stylesync/core';

export function registerSyncCommand(program: Command) {
  program
    .command('sync')
    .description('Delta-sync sources')
    .option('--source <id>', 'sync only this source')
    .option('--full', 'full re-sync, ignoring content-hash short-circuiting')
    .option('--add <url>', 'ad-hoc URL to capture via the "url" adapter (implies --source url)')
    .action(async (opts: { source?: string; full?: boolean; add?: string }) => {
      const db = new StyleSyncDB();
      const targets = opts.add ? ['url'] : opts.source ? [opts.source] : listAdapters().map((a) => a.id);

      for (const sourceId of targets) {
        console.log(pc.bold(`\n▸ syncing ${sourceId}${opts.full ? ' (full)' : ''}`));
        try {
          const stats = await syncSource(
            db,
            { sourceId, full: opts.full, urls: opts.add ? [opts.add] : undefined, trigger: 'cli' },
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
      db.close();
    });
}
