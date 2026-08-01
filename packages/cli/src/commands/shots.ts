import type { Command } from 'commander';
import pc from 'picocolors';
import { takeShots } from '@stylesync/core';

export function registerShotsCommand(program: Command) {
  program
    .command('shots')
    .description('Before/after screenshots (assumes your dev server is already running)')
    .option('--routes <list>', 'comma-separated routes', '/')
    .option('--base-url <url>', 'dev server URL', 'http://localhost:5173')
    .action(async (opts: { routes: string; baseUrl: string }) => {
      const routes = opts.routes.split(',').map((r) => r.trim());
      console.log(pc.dim(`Shooting ${routes.length} route(s) against ${opts.baseUrl} — make sure your dev server is running.`));
      try {
        const written = await takeShots({ projectPath: process.cwd(), routes, baseUrl: opts.baseUrl });
        console.log(pc.green(`✔ wrote ${written.length} screenshot(s) to .stylesync/shots/`));
        for (const f of written) console.log(`  ${f}`);
      } catch (err) {
        console.error(pc.red((err as Error).message));
        process.exitCode = 1;
      }
    });
}
