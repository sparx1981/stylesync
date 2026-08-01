import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StyleSyncDB } from '../db/db.js';
import type { DRP } from '../drp/types.js';
import { renderTokensCss } from './tokensCss.js';
import { renderTailwindTheme } from './tailwindTheme.js';
import { renderComponentsMd } from './componentsMd.js';
import { renderStylepackMd } from './stylepackMd.js';
import { renderTokensJson } from './tokensJson.js';

export interface GeneratePackOptions {
  refId: string;
  outDir?: string;
  projectPath?: string;
}

export interface GeneratePackResult {
  outDir: string;
  filesWritten: string[];
  drp: DRP;
}

export function generatePack(db: StyleSyncDB, opts: GeneratePackOptions): GeneratePackResult {
  const ref = db.getRef(opts.refId);
  if (!ref) throw new Error(`No reference found with id "${opts.refId}". Run \`stylesync search\` to find one.`);

  const drpRow = db.getDrp(opts.refId);
  if (!drpRow) throw new Error(`No DRP built yet for "${opts.refId}" — run \`stylesync sync\` first, or \`stylesync show ${opts.refId}\` to check status.`);

  const drp = JSON.parse(drpRow.profile) as DRP;
  const outDir = opts.outDir ?? join(process.cwd(), '.stylesync');
  const projectPath = opts.projectPath ?? process.cwd();

  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'reference'), { recursive: true });

  const filesWritten: string[] = [];
  const write = (relPath: string, content: string) => {
    const p = join(outDir, relPath);
    writeFileSync(p, content);
    filesWritten.push(relPath);
  };

  write('STYLEPACK.md', renderStylepackMd(drp));
  write('tokens.css', renderTokensCss(drp));
  write('tailwind.theme.ts', renderTailwindTheme(drp));
  write('tokens.json', renderTokensJson(drp));
  write('components.md', renderComponentsMd(drp));

  const assets = db.listAssets(opts.refId);
  const screenshotAsset = assets.find((a) => a.kind === 'screenshot');
  if (screenshotAsset) {
    const src = join(db.dataDir, screenshotAsset.path);
    if (existsSync(src)) {
      const dest = join(outDir, 'reference', 'screenshot.png');
      copyFileSync(src, dest);
      filesWritten.push('reference/screenshot.png');
    }
  }
  write('reference/source.txt', `${ref.origin_url}\nCreator credit: ${ref.creator_credit ?? 'unknown'}\nSource: ${ref.source_id}\n`);

  const packId = `pack_${randomUUID().slice(0, 8)}`;
  const packJson = { pack_id: packId, ref_id: opts.refId, drp_version: drp.drp_version, confidence: drp.provenance.confidence, generated_at: new Date().toISOString() };
  write('pack.json', JSON.stringify(packJson, null, 2) + '\n');

  db.recordPack({
    id: packId,
    ref_id: opts.refId,
    project_path: projectPath,
    created_at: packJson.generated_at,
    applied: JSON.stringify({ deterministic: [], notes: 'pack generated, not yet applied' }),
  });
  db.incrementUsedCount(opts.refId);

  return { outDir, filesWritten, drp };
}
