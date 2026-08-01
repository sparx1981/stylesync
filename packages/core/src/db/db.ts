import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SourceRow {
  id: string;
  display_name: string;
  category: 'flows' | 'web' | 'vector' | 'motion';
  access_method: 'api' | 'sitemap' | 'headless';
  base_url: string;
  rpm: number;
  enabled: number;
  last_sync_at: string | null;
  health: string | null;
}

export interface RefRow {
  id: string;
  source_id: string;
  external_id: string;
  origin_url: string;
  title: string | null;
  creator_credit: string | null;
  captured_at: string;
  last_synced_at: string;
  content_hash: string;
  visual_hash: string | null;
  status: 'ready' | 'partial' | 'failed';
  tags: string | null;
  favorite: number;
  used_count: number;
}

export interface RefAssetRow {
  ref_id: string;
  kind: 'screenshot' | 'thumb' | 'dom' | 'css' | 'video' | 'figma_node' | 'flow';
  path: string;
  bytes: number | null;
  meta: string | null;
}

export interface DrpRow {
  ref_id: string;
  version: number;
  profile: string;
  confidence: number;
  method: 'computed_css' | 'figma_api' | 'vision_inferred';
  built_at: string;
}

export interface PackRow {
  id: string;
  ref_id: string;
  project_path: string;
  created_at: string;
  applied: string | null;
}

export interface SyncRunRow {
  id: string;
  source_id: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  log_path: string | null;
}

/**
 * Resolve the on-disk location of data/stylesync.db.
 * Walks up from cwd looking for a `data/` directory sibling to a pnpm-workspace.yaml,
 * falling back to ./data relative to cwd. This lets the CLI work from any project
 * subdirectory the way `git` finds `.git`.
 */
export function resolveDataDir(startDir = process.cwd()): string {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return join(dir, 'data');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(startDir, 'data');
}

export class StyleSyncDB {
  readonly db: Database.Database;
  readonly dataDir: string;

  constructor(dataDir = resolveDataDir()) {
    this.dataDir = dataDir;
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(join(dataDir, 'refs'), { recursive: true });
    const dbPath = join(dataDir, 'stylesync.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate() {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  close() {
    this.db.close();
  }

  // --- sources -------------------------------------------------------

  upsertSource(s: SourceRow) {
    this.db
      .prepare(
        `insert into sources (id, display_name, category, access_method, base_url, rpm, enabled, last_sync_at, health)
         values (@id, @display_name, @category, @access_method, @base_url, @rpm, @enabled, @last_sync_at, @health)
         on conflict(id) do update set
           display_name=excluded.display_name, category=excluded.category,
           access_method=excluded.access_method, base_url=excluded.base_url,
           rpm=excluded.rpm`
      )
      .run(s);
  }

  listSources(): SourceRow[] {
    return this.db.prepare('select * from sources order by id').all() as SourceRow[];
  }

  getSource(id: string): SourceRow | undefined {
    return this.db.prepare('select * from sources where id = ?').get(id) as SourceRow | undefined;
  }

  setSourceHealth(id: string, health: unknown) {
    this.db.prepare('update sources set health = ? where id = ?').run(JSON.stringify(health), id);
  }

  setSourceLastSync(id: string, iso: string) {
    this.db.prepare('update sources set last_sync_at = ? where id = ?').run(iso, id);
  }

  setSourceEnabled(id: string, enabled: boolean) {
    this.db.prepare('update sources set enabled = ? where id = ?').run(enabled ? 1 : 0, id);
  }

  // --- refs ------------------------------------------------------------

  upsertRef(r: RefRow): 'added' | 'updated' | 'unchanged' {
    const existing = this.db
      .prepare('select content_hash from refs where source_id = ? and external_id = ?')
      .get(r.source_id, r.external_id) as { content_hash: string } | undefined;

    this.db
      .prepare(
        `insert into refs (id, source_id, external_id, origin_url, title, creator_credit, captured_at,
            last_synced_at, content_hash, visual_hash, status, tags, favorite, used_count)
         values (@id, @source_id, @external_id, @origin_url, @title, @creator_credit, @captured_at,
            @last_synced_at, @content_hash, @visual_hash, @status, @tags, @favorite, @used_count)
         on conflict(source_id, external_id) do update set
           origin_url=excluded.origin_url, title=excluded.title, creator_credit=excluded.creator_credit,
           last_synced_at=excluded.last_synced_at, content_hash=excluded.content_hash,
           visual_hash=excluded.visual_hash, status=excluded.status, tags=excluded.tags`
      )
      .run(r);

    if (!existing) return 'added';
    if (existing.content_hash !== r.content_hash) return 'updated';
    return 'unchanged';
  }

  getRef(id: string): RefRow | undefined {
    return this.db.prepare('select * from refs where id = ?').get(id) as RefRow | undefined;
  }

  listRefs(opts: { source?: string; tag?: string; favorite?: boolean } = {}): RefRow[] {
    let sql = 'select * from refs where 1=1';
    const params: unknown[] = [];
    if (opts.source) {
      sql += ' and source_id = ?';
      params.push(opts.source);
    }
    if (opts.favorite) {
      sql += ' and favorite = 1';
    }
    if (opts.tag) {
      sql += " and tags like ?";
      params.push(`%${opts.tag}%`);
    }
    sql += ' order by captured_at desc';
    return this.db.prepare(sql).all(...params) as RefRow[];
  }

  searchRefs(query: string): RefRow[] {
    const rows = this.db
      .prepare(
        `select refs.* from refs_fts
         join refs on refs.id = refs_fts.id
         where refs_fts match ?
         order by rank`
      )
      .all(query.replace(/["]/g, '')) as RefRow[];
    return rows;
  }

  incrementUsedCount(refId: string) {
    this.db.prepare('update refs set used_count = used_count + 1 where id = ?').run(refId);
  }

  // --- assets ------------------------------------------------------------

  addAsset(a: RefAssetRow) {
    this.db
      .prepare(
        `insert into ref_assets (ref_id, kind, path, bytes, meta) values (@ref_id, @kind, @path, @bytes, @meta)
         on conflict(ref_id, kind, path) do update set bytes=excluded.bytes, meta=excluded.meta`
      )
      .run(a);
  }

  listAssets(refId: string): RefAssetRow[] {
    return this.db.prepare('select * from ref_assets where ref_id = ?').all(refId) as RefAssetRow[];
  }

  // --- drps ------------------------------------------------------------

  upsertDrp(d: DrpRow) {
    this.db
      .prepare(
        `insert into drps (ref_id, version, profile, confidence, method, built_at)
         values (@ref_id, @version, @profile, @confidence, @method, @built_at)
         on conflict(ref_id) do update set
           version=excluded.version, profile=excluded.profile, confidence=excluded.confidence,
           method=excluded.method, built_at=excluded.built_at`
      )
      .run(d);
  }

  getDrp(refId: string): DrpRow | undefined {
    return this.db.prepare('select * from drps where ref_id = ?').get(refId) as DrpRow | undefined;
  }

  // --- packs ------------------------------------------------------------

  recordPack(p: PackRow) {
    this.db
      .prepare(
        `insert into packs (id, ref_id, project_path, created_at, applied) values (@id, @ref_id, @project_path, @created_at, @applied)`
      )
      .run(p);
  }

  listPacks(projectPath?: string): PackRow[] {
    if (projectPath) {
      return this.db
        .prepare('select * from packs where project_path = ? order by created_at desc')
        .all(projectPath) as PackRow[];
    }
    return this.db.prepare('select * from packs order by created_at desc').all() as PackRow[];
  }

  // --- sync runs ------------------------------------------------------------

  startSyncRun(run: Omit<SyncRunRow, 'finished_at' | 'discovered' | 'added' | 'updated' | 'unchanged' | 'failed' | 'log_path'>) {
    this.db
      .prepare(
        `insert into sync_runs (id, source_id, trigger, started_at, discovered, added, updated, unchanged, failed)
         values (?, ?, ?, ?, 0, 0, 0, 0, 0)`
      )
      .run(run.id, run.source_id, run.trigger, run.started_at);
  }

  finishSyncRun(id: string, stats: Omit<SyncRunRow, 'id' | 'source_id' | 'trigger' | 'started_at'>) {
    this.db
      .prepare(
        `update sync_runs set finished_at=?, discovered=?, added=?, updated=?, unchanged=?, failed=?, log_path=? where id=?`
      )
      .run(stats.finished_at, stats.discovered, stats.added, stats.updated, stats.unchanged, stats.failed, stats.log_path, id);
  }

  listSyncRuns(sourceId?: string): SyncRunRow[] {
    if (sourceId) {
      return this.db
        .prepare('select * from sync_runs where source_id = ? order by started_at desc')
        .all(sourceId) as SyncRunRow[];
    }
    return this.db.prepare('select * from sync_runs order by started_at desc limit 50').all() as SyncRunRow[];
  }
}
