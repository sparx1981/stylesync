import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB, type DRP } from '@stylesync/core';

export function registerShowCommand(program: Command) {
  program
    .command('show <ref_id>')
    .description('Print the DRP summary')
    .action(async (refId: string) => {
      const db = new StyleSyncDB();
      const ref = db.getRef(refId);
      if (!ref) {
        console.error(pc.red(`No reference "${refId}".`));
        db.close();
        process.exitCode = 1;
        return;
      }
      const drpRow = db.getDrp(refId);
      console.log(pc.bold(ref.title ?? refId));
      console.log(pc.dim(ref.origin_url));
      console.log(`status: ${ref.status}  favorite: ${ref.favorite ? 'yes' : 'no'}  used: ${ref.used_count}x`);

      if (!drpRow) {
        console.log(pc.yellow('\nNo DRP built yet.'));
        db.close();
        return;
      }
      const drp = JSON.parse(drpRow.profile) as DRP;
      console.log(`\nconfidence: ${drp.provenance.confidence.toFixed(2)}  method: ${drp.provenance.extraction_method}`);
      console.log(`theme: ${drp.identity.theme_mode}  density: ${drp.identity.density}`);
      console.log(`descriptors: ${drp.identity.descriptors.join(', ')}`);
      console.log(pc.bold('\nPalette:'));
      for (const [role, ramp] of Object.entries(drp.color.palette)) {
        if (ramp) console.log(`  ${role.padEnd(10)} ${ramp.base}`);
      }
      console.log(pc.bold('\nType scale:'), `ratio ${drp.typography.scale.ratio}, base ${drp.typography.scale.base_px}px`);
      console.log(pc.bold('Spacing:'), `unit ${drp.space.unit_px}px`);
      console.log(pc.bold('Elevation:'), drp.elevation.strategy);
      console.log(pc.bold('\nAnti-patterns:'));
      for (const p of drp.anti_patterns) console.log(`  - ${p}`);
      db.close();
    });
}
