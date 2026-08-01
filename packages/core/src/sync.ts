import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StyleSyncDB } from './db/db.js';
import { getAdapter } from './adapters/registry.js';
import { contentHash, visualHashPlaceholder } from './util/hash.js';
import { buildDRP } from './drp/extract.js';
import { validateQualityGate } from './drp/qualityGate.js';
import type { RawCapture } from './adapters/types.js';

export interface SyncOptions {
  sourceId: string;
  full?: boolean;
  urls?: string[];
  trigger?: string;
}

export interface SyncStats {
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  changedRefIds: string[];
}

export async function syncSource(db: StyleSyncDB, opts: SyncOptions, log: (msg: string) => void = console.log): Promise<SyncStats> {
  const adapter = getAdapter(opts.sourceId);
  if (!adapter) throw new Error(`No adapter registered for source "${opts.sourceId}"`);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  db.startSyncRun({ id: runId, source_id: opts.sourceId, trigger: opts.trigger ?? 'manual', started_at: startedAt });

  db.upsertSource({
    id: adapter.id,
    display_name: adapter.displayName,
    category: adapter.category,
    access_method: adapter.accessMethod,
    base_url: adapter.baseUrl,
    rpm: adapter.rpm,
    enabled: 1,
    last_sync_at: null,
    health: null,
  });

  const stats: SyncStats = { discovered: 0, added: 0, updated: 0, unchanged: 0, failed: 0, changedRefIds: [] };
  const ctx = {
    dataDir: db.dataDir,
    rpm: adapter.rpm,
    full: !!opts.full,
    config: opts.urls ? { urls: opts.urls } : {},
    log,
  };

  const logLines: string[] = [];
  const logAndCapture = (msg: string) => {
    logLines.push(`[${new Date().toISOString()}] ${msg}`);
    log(msg);
  };
  ctx.log = logAndCapture;

  try {
    for await (const item of adapter.discover(ctx)) {
      stats.discovered++;
      const refId = `ref_${adapter.id.replace(/-/g, '')}_${item.externalId}`.slice(0, 64);

      try {
        const existing = db.getRef(refId);
        if (!opts.full && existing) {
          const sig = await adapter.signature(item, ctx);
          if (sig === existing.content_hash) {
            stats.unchanged++;
            continue;
          }
        }

        const capture = await adapter.capture(item, ctx);
        const outcome = await persistCapture(db, adapter.id, refId, item.externalId, capture);
        stats[outcome]++;
        if (outcome !== 'unchanged') stats.changedRefIds.push(refId);

        if (capture.status !== 'failed') {
          try {
            const drp = buildDRP(refId, adapter.id, capture);
            const gated = validateQualityGate(drp);
            db.upsertDrp({
              ref_id: refId,
              version: 1,
              profile: JSON.stringify(gated.drp),
              confidence: gated.drp.provenance.confidence,
              method: gated.drp.provenance.extraction_method,
              built_at: new Date().toISOString(),
            });
            if (!gated.passed) {
              logAndCapture(`${refId}: DRP built but quality gate warnings: ${gated.warnings.join('; ')}`);
            }
          } catch (err) {
            logAndCapture(`${refId}: DRP extraction failed: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        stats.failed++;
        logAndCapture(`${refId}: capture failed: ${(err as Error).message}`);
      }
    }

    const health = await adapter.health(ctx);
    db.setSourceHealth(adapter.id, health);
    db.setSourceLastSync(adapter.id, new Date().toISOString());
  } finally {
    const logDir = join(db.dataDir, 'logs');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `${runId}.log`);
    writeFileSync(logPath, logLines.join('\n'));

    db.finishSyncRun(runId, {
      finished_at: new Date().toISOString(),
      discovered: stats.discovered,
      added: stats.added,
      updated: stats.updated,
      unchanged: stats.unchanged,
      failed: stats.failed,
      log_path: logPath,
    });
  }

  return stats;
}

async function persistCapture(
  db: StyleSyncDB,
  sourceId: string,
  refId: string,
  externalId: string,
  capture: RawCapture
): Promise<'added' | 'updated' | 'unchanged'> {
  const dir = join(db.dataDir, 'refs', sourceId, externalId);
  mkdirSync(dir, { recursive: true });

  const contentHashValue = contentHash(capture.canonicalContent || refId);
  const visualHashValue = visualHashPlaceholder(capture.screenshotPng);

  if (capture.screenshotPng) {
    const p = join(dir, 'screenshot.png');
    writeFileSync(p, capture.screenshotPng);
    db.addAsset({ ref_id: refId, kind: 'screenshot', path: relPath(db.dataDir, p), bytes: capture.screenshotPng.length, meta: null });
  }
  if (capture.thumbPng) {
    const p = join(dir, 'thumb.png');
    writeFileSync(p, capture.thumbPng);
    db.addAsset({ ref_id: refId, kind: 'thumb', path: relPath(db.dataDir, p), bytes: capture.thumbPng.length, meta: null });
  }
  if (capture.dom) {
    const p = join(dir, 'dom.json');
    writeFileSync(p, JSON.stringify({ html: capture.dom }));
    db.addAsset({ ref_id: refId, kind: 'dom', path: relPath(db.dataDir, p), bytes: null, meta: null });
  }
  if (capture.computedStyles) {
    const p = join(dir, 'computed-styles.json');
    writeFileSync(p, JSON.stringify(capture.computedStyles));
    db.addAsset({ ref_id: refId, kind: 'css', path: relPath(db.dataDir, p), bytes: null, meta: JSON.stringify({ kind: 'computed-styles' }) });
  }
  if (capture.stylesheetText) {
    const p = join(dir, 'styles.css');
    writeFileSync(p, capture.stylesheetText);
    db.addAsset({ ref_id: refId, kind: 'css', path: relPath(db.dataDir, p), bytes: capture.stylesheetText.length, meta: null });
  }
  if (capture.figmaNode) {
    const p = join(dir, 'figma-node.json');
    writeFileSync(p, JSON.stringify(capture.figmaNode));
    db.addAsset({ ref_id: refId, kind: 'figma_node', path: relPath(db.dataDir, p), bytes: null, meta: null });
  }

  const outcome = db.upsertRef({
    id: refId,
    source_id: sourceId,
    external_id: externalId,
    origin_url: capture.originUrl,
    title: capture.title ?? null,
    creator_credit: capture.creatorCredit ?? null,
    captured_at: capture.capturedAt,
    last_synced_at: new Date().toISOString(),
    content_hash: contentHashValue,
    visual_hash: visualHashValue ?? null,
    status: capture.status,
    tags: null,
    favorite: 0,
    used_count: 0,
  });

  return outcome;
}

function relPath(dataDir: string, absPath: string): string {
  return absPath.startsWith(dataDir) ? absPath.slice(dataDir.length + 1) : absPath;
}
