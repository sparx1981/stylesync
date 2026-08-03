#!/usr/bin/env node
import { Command } from 'commander';
import { registerSyncCommand } from './commands/sync.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerSearchCommand } from './commands/search.js';
import { registerShowCommand } from './commands/show.js';
import { registerPackCommand } from './commands/pack.js';
import { registerBrandGuideCommand } from './commands/brandGuide.js';
import { registerApplyCommand } from './commands/apply.js';
import { registerShotsCommand } from './commands/shots.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerWebCommand } from './commands/web.js';

const program = new Command();

program
  .name('stylesync')
  .description('Turn a design you admire into a design system your coding agent can follow.')
  .version('2.0.0')
  .option('--json', 'machine-readable output where supported')
  .option('--force', 'skip safety preconditions (clean git tree, etc.)');

registerSyncCommand(program);
registerDoctorCommand(program);
registerSearchCommand(program);
registerShowCommand(program);
registerPackCommand(program);
registerBrandGuideCommand(program);
registerApplyCommand(program);
registerShotsCommand(program);
registerHistoryCommand(program);
registerWebCommand(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
