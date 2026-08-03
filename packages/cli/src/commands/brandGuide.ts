import type { Command } from 'commander';
import pc from 'picocolors';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StyleSyncDB, renderBrandGuidePdf } from '@stylesync/core';
import type { DRP } from '@stylesync/core';

export function registerBrandGuideCommand(program: Command) {
  program
    .command('brand-guide <ref_id>')
    .description('Generate a Brand Guidelines PDF for a reference')
    .option('--out <path>', 'output file path', 'brand-guide.pdf')
    .action(async (refId: string, opts: { out: string }) => {
      const db = new StyleSyncDB();
      try {
        const ref = db.getRef(refId);
        if (!ref) throw new Error(`No reference found with id "${refId}". Run \`stylesync search\` to find one.`);

        const drpRow = db.getDrp(refId);
        if (!drpRow) throw new Error(`No DRP built yet for "${refId}" — run \`stylesync sync\` first.`);
        const drp = JSON.parse(drpRow.profile) as DRP;

        let screenshotPng: Buffer | undefined;
        const assets = db.listAssets(refId);
        const screenshotAsset = assets.find((a) => a.kind === 'screenshot');
        if (screenshotAsset) {
          try {
            const { readFileSync, existsSync } = await import('node:fs');
            const fullPath = join(db.dataDir, screenshotAsset.path);
            if (existsSync(fullPath)) screenshotPng = readFileSync(fullPath);
          } catch {
            // Cover image is optional — proceed without it.
          }
        }

        const pdf = await renderBrandGuidePdf(drp, { screenshotPng });
        const outPath = opts.out.startsWith('/') ? opts.out : join(process.cwd(), opts.out);
        writeFileSync(outPath, pdf);
        console.log(pc.green(`✔ wrote ${outPath}`));
        console.log(pc.dim(`confidence: ${drp.provenance.confidence.toFixed(2)} (${drp.provenance.extraction_method})`));
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exitCode = 1;
      } finally {
        db.close();
      }
    });
}
