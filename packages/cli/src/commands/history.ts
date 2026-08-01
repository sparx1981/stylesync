import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB } from '@stylesync/core';

export function registerHistoryCommand(program: Command) {
  program
    .command('history')
    .description('What was applied where, when')
    .option('--project <path>', 'filter to a project path')
    .action(async (opts: { project?: string }) => {
      const db = new StyleSyncDB();
      const packs = db.listPacks(opts.project);
      if (packs.length === 0) {
        console.log(pc.dim('No packs generated yet — run `stylesync pack <ref_id>` from inside a project.'));
      }
      for (const p of packs) {
        const ref = db.getRef(p.ref_id);
        console.log(`${pc.cyan(p.id)}  ${ref?.title ?? p.ref_id}  ${pc.dim(p.project_path)}  ${pc.dim(p.created_at)}`);
      }
      db.close();
    });
}
