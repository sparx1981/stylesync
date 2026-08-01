import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB, listAdapters } from '@stylesync/core';

export function registerDoctorCommand(program: Command) {
  program
    .command('doctor')
    .description('Adapter health, partial captures, failed DRPs')
    .action(async () => {
      const db = new StyleSyncDB();
      const adapters = listAdapters();

      console.log(pc.bold('Adapters:'));
      for (const adapter of adapters) {
        const row = db.getSource(adapter.id);
        const health = row?.health ? (JSON.parse(row.health) as { ok: boolean; message: string }) : undefined;
        const icon = !row ? pc.dim('○ never synced') : health?.ok ? pc.green('● healthy') : pc.red('● unhealthy');
        console.log(`  ${adapter.id.padEnd(14)} ${icon}${health && !health.ok ? pc.dim(` — ${health.message}`) : ''}`);
      }

      const partial = db.listRefs().filter((r) => r.status === 'partial');
      const failed = db.listRefs().filter((r) => r.status === 'failed');
      console.log(pc.bold(`\nPartial captures: ${partial.length}`));
      for (const r of partial.slice(0, 10)) console.log(`  ${pc.yellow(r.id)} — ${r.origin_url}`);

      console.log(pc.bold(`\nFailed captures: ${failed.length}`));
      for (const r of failed.slice(0, 10)) console.log(`  ${pc.red(r.id)} — ${r.origin_url}`);

      const allRefs = db.listRefs();
      const withoutDrp = allRefs.filter((r) => !db.getDrp(r.id));
      console.log(pc.bold(`\nRefs without a DRP: ${withoutDrp.length}`));

      db.close();

      if (adapters.every((a) => !db.getSource(a.id))) {
        console.log(pc.dim('\nNothing synced yet — run `stylesync sync` to get started.'));
      }
    });
}
