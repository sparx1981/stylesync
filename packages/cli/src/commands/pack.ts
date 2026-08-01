import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB, generatePack } from '@stylesync/core';

export function registerPackCommand(program: Command) {
  program
    .command('pack <ref_id>')
    .description('Generate the Style Pack into cwd')
    .option('--out <dir>', 'output directory', '.stylesync')
    .action(async (refId: string, opts: { out: string }) => {
      const db = new StyleSyncDB();
      try {
        const result = generatePack(db, { refId, outDir: opts.out.startsWith('/') ? opts.out : `${process.cwd()}/${opts.out}` });
        console.log(pc.green(`✔ wrote ${result.filesWritten.length} files to ${result.outDir}`));
        for (const f of result.filesWritten) console.log(`  ${f}`);
        console.log(pc.dim(`\nconfidence: ${result.drp.provenance.confidence.toFixed(2)} (${result.drp.provenance.extraction_method})`));
        console.log(pc.bold('\nNext:'), 'point your coding agent at .stylesync/STYLEPACK.md, or run `stylesync apply --deterministic` for the codemod pass.');
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    });
}
