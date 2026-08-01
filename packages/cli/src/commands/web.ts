import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function registerWebCommand(program: Command) {
  program
    .command('web')
    .description('Start the local library on :4321')
    .action(() => {
      // packages/cli/src/commands -> ../../../.. -> repo root -> apps/web
      const webDir = join(__dirname, '..', '..', '..', '..', 'apps', 'web');
      console.log(pc.dim(`Starting Next.js dev server from ${webDir} on http://localhost:4321 ...`));
      const child = spawn('npx', ['next', 'dev', '-p', '4321'], { cwd: webDir, stdio: 'inherit' });
      child.on('exit', (code) => process.exit(code ?? 0));
    });
}
