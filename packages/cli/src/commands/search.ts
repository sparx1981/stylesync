import type { Command } from 'commander';
import pc from 'picocolors';
import { StyleSyncDB } from '@stylesync/core';

export function registerSearchCommand(program: Command) {
  program
    .command('search <query>')
    .description('Search from the terminal')
    .option('--source <id>', 'restrict to one source')
    .option('--tag <tag>', 'restrict to a tag')
    .action(async (query: string, opts: { source?: string; tag?: string }) => {
      const db = new StyleSyncDB();
      let results = db.searchRefs(query);
      if (opts.source) results = results.filter((r) => r.source_id === opts.source);
      if (opts.tag) results = results.filter((r) => (r.tags ?? '').includes(opts.tag!));

      if (results.length === 0) {
        console.log(pc.dim('No matches.'));
      } else {
        for (const r of results.slice(0, 25)) {
          const drp = db.getDrp(r.id);
          const conf = drp ? ` ${pc.dim(`(confidence ${drp.confidence.toFixed(2)})`)}` : '';
          console.log(`${pc.cyan(r.id)}  ${r.title ?? '(untitled)'}${conf}`);
        }
      }
      db.close();
    });
}
