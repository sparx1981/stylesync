import { sql } from '@vercel/postgres';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceRow, RefRow, RefAssetRow, DrpRow, PackRow, SyncRunRow } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Migration is idempotent (`create table if not exists`) and cheap, but we
// still only want to run it once per warm serverless instance rather than on
// every request.
let migrated: Promise<void> | undefined;

/**
 * Postgres-backed twin of StyleSyncDB, used only by the deployed web app
 * (apps/web/lib/db.ts picks this when POSTGRES_URL is set — i.e. on Vercel
 * with a Postgres database attached). The CLI and local `pnpm web dev` keep
 * using the local SQLite file via StyleSyncDB; this class exists purely to
 * make the hosted deployment work on Vercel's read-only filesystem.
 *
 * Method names and shapes intentionally match StyleSyncDB so callers can
 * `await db.method(...)` against either implementation.
 */
export class StyleSyncPostgresDB {
    constructor() {
          migrated ??= this.migrate();
    }

  private async ready() {
        await migrated;
  }

  private async migrate() {
        const schemaPath = join(__dirname, 'schema.postgres.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        const statements = schema
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
                await sql.query(stmt);
        }
  }

  // --- sources -------------------------------------------------------

  async upsertSource(s: SourceRow) {
        await this.ready();
        await sql`
              insert into sources (id, display_name, category, access_method, base_url, rpm, enabled, last_sync_at, health)
                    values (${s.id}, ${s.display_name}, ${s.category}, ${s.access_method}, ${s.base_url}, ${s.rpm}, ${s.enabled}, ${s.last_sync_at}, ${s.health})
                          on conflict (id) do update set
                                  display_name = excluded.display_name, category = excluded.category,
                                          access_method = excluded.access_method, base_url = excluded.base_url,
                                                  rpm = excluded.rpm
                                                      `;
  }

  async listSources(): Promise<SourceRow[]> {
        await this.ready();
        const { rows } = await sql<SourceRow>`select * from sources order by id`;
        return rows;
  }

  async getSource(id: string): Promise<SourceRow | undefined> {
        await this.ready();
        const { rows } = await sql<SourceRow>`select * from sources where id = ${id}`;
        return rows[0];
  }

  async setSourceHealth(id: string, health: unknown) {
        await this.ready();
        await sql`update sources set health = ${JSON.stringify(health)} where id = ${id}`;
  }

  async setSourceLastSync(id: string, iso: string) {
        await this.ready();
        await sql`update sources set last_sync_at = ${iso} where id = ${id}`;
  }

  async setSourceEnabled(id: string, enabled: boolean) {
        await this.ready();
        await sql`update sources set enabled = ${enabled ? 1 : 0} where id = ${id}`;
  }

  // --- refs ------------------------------------------------------------

  async upsertRef(r: RefRow): Promise<'added' | 'updated' | 'unchanged'> {
        await this.ready();
        const { rows: existingRows } = await sql<{ content_hash: string }>`
              select content_hash from refs where source_id = ${r.source_id} and external_id = ${r.external_id}
                  `;
        const existing = existingRows[0];

      await sql`
            insert into refs (id, source_id, external_id, origin_url, title, creator_credit, captured_at,
                      last_synced_at, content_hash, visual_hash, status, tags, favorite, used_count)
                            values (${r.id}, ${r.source_id}, ${r.external_id}, ${r.origin_url}, ${r.title}, ${r.creator_credit}, ${r.captured_at},
                                      ${r.last_synced_at}, ${r.content_hash}, ${r.visual_hash}, ${r.status}, ${r.tags}, ${r.favorite}, ${r.used_count})
                                            on conflict (source_id, external_id) do update set
                                                    origin_url = excluded.origin_url, title = excluded.title, creator_credit = excluded.creator_credit,
                                                            last_synced_at = excluded.last_synced_at, content_hash = excluded.content_hash,
                                                                    visual_hash = excluded.visual_hash, status = excluded.status, tags = excluded.tags
                                                                        `;

      if (!existing) return 'added';
        if (existing.content_hash !== r.content_hash) return 'updated';
        return 'unchanged';
  }

  async getRef(id: string): Promise<RefRow | undefined> {
        await this.ready();
        const { rows } = await sql<RefRow>`select * from refs where id = ${id}`;
        return rows[0];
  }

  async listRefs(opts: { source?: string; tag?: string; favorite?: boolean } = {}): Promise<RefRow[]> {
        await this.ready();
        // @vercel/postgres's `sql` tagged template can't build a fully dynamic
      // WHERE clause, so fall back to sql.query with manual $n params here.
      const clauses: string[] = ['1=1'];
        const params: unknown[] = [];
        if (opts.source) {
                params.push(opts.source);
                clauses.push(`source_id = $${params.length}`);
        }
        if (opts.favorite) {
                clauses.push('favorite = 1');
        }
        if (opts.tag) {
                params.push(`%${opts.tag}%`);
                clauses.push(`tags like $${params.length}`);
        }
        const { rows } = await sql.query(`select * from refs where ${clauses.join(' and ')} order by captured_at desc`, params);
        return rows as RefRow[];
  }

  async searchRefs(query: string): Promise<RefRow[]> {
        await this.ready();
        const { rows } = await sql<RefRow>`
              select refs.* from refs
                    where search_vector @@ plainto_tsquery('english', ${query})
                          order by ts_rank(search_vector, plainto_tsquery('english', ${query})) desc
                              `;
        return rows;
  }

  async incrementUsedCount(refId: string) {
        await this.ready();
        await sql`update refs set used_count = used_count + 1 where id = ${refId}`;
  }

  // --- assets ------------------------------------------------------------

  async addAsset(a: RefAssetRow) {
        await this.ready();
        await sql`
              insert into ref_assets (ref_id, kind, path, bytes, meta)
                    values (${a.ref_id}, ${a.kind}, ${a.path}, ${a.bytes}, ${a.meta})
                          on conflict (ref_id, kind, path) do update set bytes = excluded.bytes, meta = excluded.meta
                              `;
  }

  async listAssets(refId: string): Promise<RefAssetRow[]> {
        await this.ready();
        const { rows } = await sql<RefAssetRow>`select * from ref_assets where ref_id = ${refId}`;
        return rows;
  }

  // --- drps ------------------------------------------------------------

  async upsertDrp(d: DrpRow) {
        await this.ready();
        await sql`
              insert into drps (ref_id, version, profile, confidence, method, built_at)
                    values (${d.ref_id}, ${d.version}, ${d.profile}, ${d.confidence}, ${d.method}, ${d.built_at})
                          on conflict (ref_id) do update set
                                  version = excluded.version, profile = excluded.profile, confidence = excluded.confidence,
                                          method = excluded.method, built_at = excluded.built_at
                                              `;
  }

  async getDrp(refId: string): Promise<DrpRow | undefined> {
        await this.ready();
        const { rows } = await sql<DrpRow>`select * from drps where ref_id = ${refId}`;
        return rows[0];
  }

  // --- packs ------------------------------------------------------------

  async recordPack(p: PackRow) {
        await this.ready();
        await sql`
              insert into packs (id, ref_id, project_path, created_at, applied)
                    values (${p.id}, ${p.ref_id}, ${p.project_path}, ${p.created_at}, ${p.applied})
                        `;
  }

  async listPacks(projectPath?: string): Promise<PackRow[]> {
        await this.ready();
        if (projectPath) {
                const { rows } = await sql<PackRow>`select * from packs where project_path = ${projectPath} order by created_at desc`;
                return rows;
        }
        const { rows } = await sql<PackRow>`select * from packs order by created_at desc`;
        return rows;
  }

  // --- sync runs ------------------------------------------------------------

  async startSyncRun(run: Omit<SyncRunRow, 'finished_at' | 'discovered' | 'added' | 'updated' | 'unchanged' | 'failed' | 'log_path'>) {
        await this.ready();
        await sql`
              insert into sync_runs (id, source_id, "trigger", started_at, discovered, added, updated, unchanged, failed)
                    values (${run.id}, ${run.source_id}, ${run.trigger}, ${run.started_at}, 0, 0, 0, 0, 0)
                        `;
  }

  async finishSyncRun(id: string, stats: Omit<SyncRunRow, 'id' | 'source_id' | 'trigger' | 'started_at'>) {
        await this.ready();
        await sql`
              update sync_runs set finished_at = ${stats.finished_at}, discovered = ${stats.discovered}, added = ${stats.added},
                      updated = ${stats.updated}, unchanged = ${stats.unchanged}, failed = ${stats.failed}, log_path = ${stats.log_path}
                            where id = ${id}
                                `;
  }

  async listSyncRuns(sourceId?: string): Promise<SyncRunRow[]> {
        await this.ready();
        if (sourceId) {
                const { rows } = await sql<SyncRunRow>`select * from sync_runs where source_id = ${sourceId} order by started_at desc`;
                return rows;
        }
        const { rows } = await sql<SyncRunRow>`select * from sync_runs order by started_at desc limit 50`;
        return rows;
  }
}
