-- StyleSync Personal — SQLite schema (spec §5)
-- Single file at data/stylesync.db. Zero ops.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

create table if not exists sources (
  id                text primary key,        -- 'lapa-ninja', 'figma', ...
  display_name      text not null,
  category          text not null,           -- flows | web | vector | motion
  access_method     text not null,           -- api | sitemap | headless
  base_url          text not null,
  rpm               integer not null default 6,
  enabled           integer not null default 1,
  last_sync_at      text,
  health            text                     -- json: {ok, message, checked_at}
);

create table if not exists refs (
  id             text primary key,           -- 'ref_lapa_4821'
  source_id      text not null references sources(id),
  external_id    text not null,
  origin_url     text not null,
  title          text,
  creator_credit text,
  captured_at    text not null,
  last_synced_at text not null,
  content_hash   text not null,
  visual_hash    text,
  status         text not null default 'ready',   -- ready | partial | failed
  tags           text,                            -- json array
  favorite       integer not null default 0,
  used_count     integer not null default 0,
  unique (source_id, external_id)
);

create table if not exists ref_assets (
  ref_id      text not null references refs(id) on delete cascade,
  kind        text not null,   -- screenshot | thumb | dom | css | video | figma_node | flow
  path        text not null,   -- relative to data/
  bytes       integer,
  meta        text,            -- json
  primary key (ref_id, kind, path)
);

create table if not exists drps (
  ref_id     text primary key references refs(id) on delete cascade,
  version    integer not null default 1,
  profile    text not null,     -- the DRP json, Appendix A
  confidence real not null,
  method     text not null,     -- computed_css | figma_api | vision_inferred
  built_at   text not null
);

create table if not exists packs (
  id          text primary key,
  ref_id      text not null references refs(id),
  project_path text not null,
  created_at  text not null,
  applied     text                       -- json: {deterministic: [...files], notes}
);

create table if not exists sync_runs (
  id text primary key, source_id text, trigger text,
  started_at text, finished_at text,
  discovered integer, added integer, updated integer, unchanged integer, failed integer,
  log_path text
);

create virtual table if not exists refs_fts using fts5(
  id unindexed, title, tags, descriptors, content='refs'
);

create trigger if not exists refs_ai after insert on refs begin
  insert into refs_fts(id, title, tags, descriptors) values (new.id, new.title, new.tags, '');
end;

create trigger if not exists refs_ad after delete on refs begin
  delete from refs_fts where id = old.id;
end;

create trigger if not exists refs_au after update on refs begin
  delete from refs_fts where id = old.id;
  insert into refs_fts(id, title, tags, descriptors) values (new.id, new.title, new.tags, '');
end;
