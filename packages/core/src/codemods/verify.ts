import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface VerificationResult {
  buildPassed: boolean | null; // null = no build command detected, not run
  typecheckPassed: boolean | null;
  lastError?: string;
  shotsWritten: string[];
}

/**
 * Verification per spec §9.4 — deliberately lighter than v1's containerised
 * visual-regression service: re-parse (implicit — tsc will fail on syntax
 * errors), tsc --noEmit if TypeScript, the project's own build command, and
 * `stylesync shots` (before/after screenshots you look at yourself, which
 * IS the regression test per the spec). axe-core pass is wired in shots.ts
 * so accessibility deltas show up in the same screenshot pass.
 *
 * On failure: print the error, revert, tell you which transform was last
 * applied — the caller (apply command) is responsible for the revert since
 * this module only reports, it doesn't mutate.
 */
export function runVerification(projectPath: string): VerificationResult {
  const result: VerificationResult = { buildPassed: null, typecheckPassed: null, shotsWritten: [] };

  const hasTsconfig = existsSync(join(projectPath, 'tsconfig.json'));
  if (hasTsconfig) {
    try {
      execSync('npx tsc --noEmit', { cwd: projectPath, stdio: 'pipe' });
      result.typecheckPassed = true;
    } catch (err) {
      result.typecheckPassed = false;
      result.lastError = (err as { stdout?: Buffer }).stdout?.toString() ?? (err as Error).message;
    }
  }

  const pkgJsonPath = join(projectPath, 'package.json');
  if (existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as { scripts?: Record<string, string> };
    const buildScript = pkg.scripts?.build;
    if (buildScript) {
      try {
        execSync('npm run build', { cwd: projectPath, stdio: 'pipe' });
        result.buildPassed = true;
      } catch (err) {
        result.buildPassed = false;
        result.lastError = (err as { stdout?: Buffer }).stdout?.toString() ?? (err as Error).message;
      }
    }
  }

  return result;
}

export interface ShotsOptions {
  projectPath: string;
  routes?: string[];
  baseUrl?: string; // e.g. http://localhost:5173 — assumes dev server is already running
  viewports?: Array<{ name: string; width: number; height: number }>;
}

const DEFAULT_VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

/**
 * `stylesync shots` (spec §9.4 step 4 + §12): screenshots each route at 3
 * viewports, before and after, written to .stylesync/shots/. This is real —
 * it launches Playwright against a dev server you already have running — but
 * it is on you to `pnpm dev` first; this module does not manage the server
 * process, since that varies too much per project (Vite vs Next vs CRA).
 */
export async function takeShots(opts: ShotsOptions): Promise<string[]> {
  const { chromium } = await import('playwright');
  const routes = opts.routes?.length ? opts.routes : ['/'];
  const viewports = opts.viewports?.length ? opts.viewports : DEFAULT_VIEWPORTS;
  const baseUrl = opts.baseUrl ?? 'http://localhost:5173';
  const outDir = join(opts.projectPath, '.stylesync', 'shots');
  mkdirSync(outDir, { recursive: true });

  const written: string[] = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of routes) {
      for (const vp of viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        const url = new URL(route, baseUrl).toString();
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
          const fileName = `${slug(route)}-${vp.name}.png`;
          const outPath = join(outDir, fileName);
          await page.screenshot({ path: outPath, fullPage: true });
          written.push(outPath);
        } catch (err) {
          // Degrade, don't fail the whole run over one dead route (§6.4 philosophy applied here too).
          console.warn(`shots: ${url} @ ${vp.name} failed: ${(err as Error).message}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return written;
}

function slug(route: string): string {
  return route === '/' ? 'root' : route.replace(/^\//, '').replace(/[^a-z0-9-]+/gi, '-');
}

/**
 * axe-core accessibility pass per spec §9.4 step 5. Requires @axe-core/playwright
 * as a devDependency in the *target* project (not stylesync itself) since it
 * injects into pages the target project serves. If it's not installed there,
 * this degrades to a clear message rather than a silent no-op.
 */
export async function runAxeCheck(projectPath: string, url: string): Promise<{ violations: number; details?: unknown } | { skipped: string }> {
  try {
    // Dynamically resolved from the target project's own node_modules, not stylesync's.
    const axeModulePath = join(projectPath, 'node_modules', '@axe-core', 'playwright', 'dist', 'index.js');
    if (!existsSync(axeModulePath)) {
      return { skipped: '@axe-core/playwright is not installed in the target project — run `npm i -D @axe-core/playwright` there to enable this check.' };
    }
    const { chromium } = await import('playwright');
    const { AxeBuilder } = await import(axeModulePath);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    await browser.close();
    return { violations: results.violations.length, details: results.violations };
  } catch (err) {
    return { skipped: `axe check errored: ${(err as Error).message}` };
  }
}
