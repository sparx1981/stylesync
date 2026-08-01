import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import type { DRP } from '../drp/types.js';
import { transformCss } from './cssTransform.js';
import { transformClassNamesInFile } from './classRewrite.js';
import { MutationLog, MutationGuardViolation } from './mutationGuard.js';
import { renderTokensCss } from '../pack/tokensCss.js';

export type IntensityLevel = 'conservative' | 'balanced' | 'bold';
export type TransformCategory = 'colors' | 'radius' | 'shadow' | 'spacing' | 'motion' | 'classes' | 'tokens';

export interface ApplyOptions {
  projectPath: string;
  drp: DRP;
  dryRun?: boolean;
  force?: boolean;
  only?: TransformCategory[];
  intensity?: IntensityLevel;
  preserveBrand?: string[];
}

export interface ApplyResult {
  filesChanged: string[];
  mutationLog: MutationLog;
  tokensCssPath: string;
  aborted?: string;
}

const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.stylesync']);
const STYLE_EXTS = new Set(['.css', '.scss']);
const COMPONENT_EXTS = new Set(['.tsx', '.jsx']);

export function assertCleanTree(projectPath: string, force = false): void {
  if (force) return;
  let status: string;
  try {
    status = execSync('git status --porcelain', { cwd: projectPath, encoding: 'utf-8' });
  } catch {
    throw new Error('Not a git repository (or git is unavailable). stylesync refuses to run without git as the rollback mechanism — `git init` first, or pass --force to proceed without it.');
  }
  if (status.trim().length > 0) {
    throw new Error('Working tree is not clean. Commit or stash your changes first (git is the entire safety net here), or pass --force to override.');
  }
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

export function applyDeterministic(opts: ApplyOptions): ApplyResult {
  assertCleanTree(opts.projectPath, opts.force);

  const only = opts.only?.length ? new Set(opts.only) : undefined;
  const log = new MutationLog();
  const filesChanged: string[] = [];

  const allFiles = walkFiles(opts.projectPath);

  const tokensCssPath = join(opts.projectPath, '.stylesync', 'tokens.css');
  const tokensCss = renderTokensCss(opts.drp);
  if (!only || only.has('tokens')) {
    if (!opts.dryRun) {
      writeFileSync(tokensCssPath, tokensCss);
    }
    log.record({ filePath: tokensCssPath, kind: 'token-file', description: 'wrote generated tokens.css' });
    filesChanged.push(tokensCssPath);

    const globalStylesheet = allFiles.find((f) => /(^|\/)(index|globals|App|main)\.css$/.test(f));
    if (globalStylesheet) {
      const content = readFileSync(globalStylesheet, 'utf-8');
      const importLine = `@import "./.stylesync/tokens.css";`;
      if (!content.includes(importLine)) {
        log.record({ filePath: globalStylesheet, kind: 'css-root-token', description: 'added tokens.css import' });
        if (!opts.dryRun) writeFileSync(globalStylesheet, `${importLine}\n${content}`);
        filesChanged.push(globalStylesheet);
      }
    }
  }

  const cssOnly = new Set<'colors' | 'radius' | 'shadow' | 'spacing' | 'motion'>();
  if (!only) {
    cssOnly.add('colors').add('radius').add('shadow').add('spacing').add('motion');
  } else {
    for (const c of ['colors', 'radius', 'shadow', 'spacing', 'motion'] as const) {
      if (only.has(c)) cssOnly.add(c);
    }
  }

  for (const file of allFiles) {
    const ext = extname(file);
    try {
      if (STYLE_EXTS.has(ext) && cssOnly.size > 0) {
        const source = readFileSync(file, 'utf-8');
        const { css, changedDeclarations } = transformCss(file, source, opts.drp, log, { preserveBrand: opts.preserveBrand, only: cssOnly });
        if (changedDeclarations > 0) {
          if (!opts.dryRun) writeFileSync(file, css);
          filesChanged.push(file);
        }
      } else if (COMPONENT_EXTS.has(ext) && (!only || only.has('classes')) && opts.intensity !== 'conservative') {
        const source = readFileSync(file, 'utf-8');
        const { code, changed } = transformClassNamesInFile(file, source, opts.drp, log, opts.preserveBrand);
        if (changed) {
          if (!opts.dryRun) writeFileSync(file, code);
          filesChanged.push(file);
        }
      }
    } catch (err) {
      if (err instanceof MutationGuardViolation) {
        if (!opts.force) revertViaGit(opts.projectPath);
        return { filesChanged, mutationLog: log, tokensCssPath, aborted: err.message };
      }
      throw err;
    }
  }

  return { filesChanged: [...new Set(filesChanged)].map((f) => relative(opts.projectPath, f) || f), mutationLog: log, tokensCssPath };
}

export function revertViaGit(projectPath: string): void {
  execSync('git checkout .', { cwd: projectPath });
}
