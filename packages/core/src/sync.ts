import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Db } from './db/getDb.js';
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

export async function syncSource(db: Db, opts: SyncOptions, log: (msg: string) => void = console.log): Promise<SyncStats> {
  const adapter = getAdapter(opts.sourceId);
  if (!adapter) throw new Error(`No adapter registered for source "${opts.sourceId}"`);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  await db.startSyncRun({ id: runId, source_id: opts.sourceId, trigger: opts.trigger ?? 'manual', started_at: startedAt });

  await db.upsertSource({
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
  const dataDir = 'dataDir' in db ? db.dataDir : join(process.cwd(), 'data');
  const ctx = {
    dataDir,
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
        const existing = await db.getRef(refId);
        if (!opts.full && existing) {
          const sig = await adapter.signature(item, ctx);
          if (sig === existing.content_hash) {
            stats.unchanged++;
            continue;
          }
        }

        const capture = await adapter.capture(item, ctx);
        const outcome = await persistCapture(db, adapter.id, refId, item.externalId, capture, ctx.dataDir, logAndCapture);
        stats[outcome]++;
        if (outcome !== 'unchanged') stats.changedRefIds.push(refId);

        if (capture.status !== 'failed') {
          try {
            const drp = await buildDRP(refId, adapter.id, capture);
            const gated = validateQualityGate(drp);
            await db.upsertDrp({
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
    await db.setSourceHealth(adapter.id, health);
    await db.setSourceLastSync(adapter.id, new Date().toISOString());
  } finally {
    const logDir = join(ctx.dataDir, 'logs');
    let logPath = '';
    try {
      mkdirSync(logDir, { recursive: true });
      logPath = join(logDir, `${runId}.log`);
      writeFileSync(logPath, logLines.join('\n'));
    } catch {
      // Read-only filesystem (e.g. a serverless-style runner) — logs still
      // went to `log` (stdout), just not persisted to disk. Non-fatal.
    }

    await db.finishSyncRun(runId, {
      finished_at: new Date().toISOString(),
      discovered: stats.discovered,
      added: stats.added,
      updated: stats.updated,
      unchanged: stats.unchanged,
      failed: stats.failed,
      log_path: logPath || null,
    });
  }

  return stats;
}

/**
 * Saves one asset either to local disk (default, used by the CLI/local dev
 * against SQLite) or to Vercel Blob (used by the GitHub Actions worker
 * against production Postgres, where there is no persistent local
 * filesystem for the web app to later read from). Blob is selected purely
 * by the presence of BLOB_READ_WRITE_TOKEN in the environment — Vercel
 * injects this automatically once Blob storage is attached to the project,
 * the same way POSTGRES_URL is injected for Neon.
 */
async function saveAssetBytes(
  dataDir: string,
  sourceId: string,
  externalId: string,
  filename: string,
  data: Buffer | string,
  log: (msg: string) => void
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import('@vercel/blob');
      const blob = await put(`refs/${sourceId}/${externalId}/${filename}`, data, {
        access: 'public',
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (err) {
      log(`asset upload to Blob failed for ${sourceId}/${externalId}/${filename}, falling back to local disk: ${(err as Error).message}`);
    }
  }
  const dir = join(dataDir, 'refs', sourceId, externalId);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, filename);
  writeFileSync(p, data);
  return p.startsWith(dataDir) ? p.slice(dataDir.length + 1) : p;
}

async function persistCapture(
  db: Db,
  sourceId: string,
  refId: string,
  externalId: string,
  capture: RawCapture,
  dataDir: string,
  log: (msg: string) => void
): Promise<'added' | 'updated' | 'unchanged'> {
  const contentHashValue = contentHash(capture.canonicalContent || refId);
  const visualHashValue = visualHashPlaceholder(capture.screenshotPng);

  if (capture.screenshotPng) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'screenshot.png', capture.screenshotPng, log);
    await db.addAsset({ ref_id: refId, kind: 'screenshot', path, bytes: capture.screenshotPng.length, meta: null });
  }
  if (capture.thumbPng) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'thumb.png', capture.thumbPng, log);
    await db.addAsset({ ref_id: refId, kind: 'thumb', path, bytes: capture.thumbPng.length, meta: null });
  }
  if (capture.motionWebm) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'motion.webm', capture.motionWebm, log);
    await db.addAsset({ ref_id: refId, kind: 'video', path, bytes: capture.motionWebm.length, meta: null });
  }
  if (capture.dom) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'dom.json', JSON.stringify({ html: capture.dom }), log);
    await db.addAsset({ ref_id: refId, kind: 'dom', path, bytes: null, meta: null });
  }
  if (capture.computedStyles) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'computed-styles.json', JSON.stringify(capture.computedStyles), log);
    await db.addAsset({ ref_id: refId, kind: 'css', path, bytes: null, meta: JSON.stringify({ kind: 'computed-styles' }) });
  }
  if (capture.stylesheetText) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'styles.css', capture.stylesheetText, log);
    await db.addAsset({ ref_id: refId, kind: 'css', path, bytes: capture.stylesheetText.length, meta: null });
  }
  if (capture.figmaNode) {
    const path = await saveAssetBytes(dataDir, sourceId, externalId, 'figma-node.json', JSON.stringify(capture.figmaNode), log);
    await db.addAsset({ ref_id: refId, kind: 'figma_node', path, bytes: null, meta: null });
  }

  const outcome = await db.upsertRef({
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
