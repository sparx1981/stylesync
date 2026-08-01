-- StyleSync Personal — Postgres schema (hosted deployment)
--
-- Mirrors packages/core/src/db/schema.sql (the SQLite schema used by the CLI
-- and by `pnpm web dev` locally). This version is used only when the web app
-- is deployed with a real Postgres database attached (e.g. Vercel Postgres) —
-- Vercel's serverless functions have a read-only filesystem, so the local
-- single-file SQLite database can't live there. See StyleSyncPostgresDB.
--
-- Differences from the SQLite schema:
--   - No PRAGMA statements (Postgres always enforces foreign keys).
--   - Full-text search: SQLite's fts5 virtual table + sync triggers are
--     replaced with a generated tsvector column + GIN index — Postgres keeps
--     it in sync automatically, no triggers needed.
--   - `trigger` is a reserved-adjacent keyword in Postgres, so it's quoted.

create table if not exists sources (
    id                text primary key,
    display_name      text not null,
    category          text not null,
    access_method     text not null,
    base_url          text not null,
    rpm               integer not null default 6,
    enabled           integer not null default 1,
    last_sync_at      text,
    health            text
  );

create table if not exists refs (
    id             text primary key,
    source_id      text not null references sources(id),
    external_id    text not null,
    origin_url     text not null,
    title          text,
    creator_credit text,
    captured_at    text not null,
    last_synced_at text not null,
    content_hash   text not null,
    visual_hash    text,
    status         text not null default 'ready',
    tags           text,
    favorite       integer not null default 0,
    used_count     integer not null default 0,
    search_vector  tsvector generated always as (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(tags, ''))
    ) stored,
    unique (source_id, external_id)
  );

create index if not exists refs_search_idx on refs using gin (search_vector);

create table if not exists ref_assets (
    ref_id      text not null references refs(id) on delete cascade,
    kind        text not null,
    path        text not null,
    bytes       integer,
    meta        text,
    primary key (ref_id, kind, path)
  );

create table if not exists drps (
    ref_id     text primary key references refs(id) on delete cascade,
    version    integer not null default 1,
    profile    text not null,
    confidence real not null,
    method     text not null,
    built_at   text not null
  );

create table if not exists packs (
    id          text primary key,
    ref_id      text not null references refs(id),
    project_path text not null,
    created_at  text not null,
    applied     text
  );

create table if not exists sync_runs (
    id text primary key, source_id text, "trigger" text,
    started_at text, finished_at text,
    discovered integer, added integer, updated integer, unchanged integer, failed integer,
    log_path text
  );
