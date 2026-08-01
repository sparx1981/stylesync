import type { Command } from 'commander';
import pc from 'picocolors';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDeterministic, type TransformCategory } from '@stylesync/core';
import type { DRP } from '@stylesync/core';

export function registerApplyCommand(program: Command) {
  program
    .command('apply')
    .description('Run codemods (stylesync apply --deterministic)')
    .option('--deterministic', 'run the deterministic codemod pass (currently the only mode implemented)')
    .option('--dry-run', 'compute changes but do not write files')
    .option('--only <categories>', 'comma-separated subset: colors,radius,shadow,spacing,motion,classes,tokens')
    .option('--intensity <level>', 'conservative | balanced | bold', 'balanced')
    .option('--preserve-brand <hexList>', 'comma-separated hex colours to exclude from remapping')
    .action(async (opts: { deterministic?: boolean; dryRun?: boolean; only?: string; intensity?: string; preserveBrand?: string }, cmd) => {
      if (!opts.deterministic) {
        console.error(pc.red('Only `--deterministic` is implemented in this build. Agent-assisted last-mile restyling is the Claude Code skill in packages/skill — see §10.'));
        process.exitCode = 1;
        return;
      }

      const projectPath = process.cwd();
      const packJsonPath = join(projectPath, '.stylesync', 'pack.json');
      if (!existsSync(packJsonPath)) {
        console.error(pc.red('No .stylesync/ folder here — run `stylesync pack <ref_id>` first.'));
        process.exitCode = 1;
        return;
      }

      // apply reads the DRP straight out of the packed tokens.json-adjacent files is
      // wasteful; instead we re-read straight from the DB via the ref id in pack.json.
      const { StyleSyncDB } = await import('@stylesync/core');
      const db = new StyleSyncDB();
      const packMeta = JSON.parse(readFileSync(packJsonPath, 'utf-8')) as { ref_id: string };
      const drpRow = db.getDrp(packMeta.ref_id);
      if (!drpRow) {
        console.error(pc.red(`No DRP found for ${packMeta.ref_id} anymore — was the database moved?`));
        db.close();
        process.exitCode = 1;
        return;
      }
      const drp = JSON.parse(drpRow.profile) as DRP;

      const force = program.opts().force as boolean | undefined;
      const only = opts.only?.split(',').map((s) => s.trim()) as TransformCategory[] | undefined;
      const preserveBrand = opts.preserveBrand?.split(',').map((s) => s.trim());

      try {
        const result = applyDeterministic({
          projectPath,
          drp,
          dryRun: opts.dryRun,
          force,
          only,
          intensity: opts.intensity as 'conservative' | 'balanced' | 'bold',
          preserveBrand,
        });

        if (result.aborted) {
          console.error(pc.red(`Aborted: ${result.aborted}`));
          console.error(pc.dim('Reverted via `git checkout .`'));
          process.exitCode = 1;
          return;
        }

        console.log(pc.green(`✔ ${opts.dryRun ? '[dry run] would change' : 'changed'} ${result.filesChanged.length} file(s)`));
        for (const f of result.filesChanged) console.log(`  ${f}`);
        console.log(pc.dim(`\n${result.mutationLog.all().length} mutations recorded through the write boundary.`));
        console.log(pc.bold('\nReview with `git diff`. Run `stylesync shots` next to see the visual delta.'));
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    });
}
