import { StyleSyncDB } from './db.js';
import { StyleSyncPostgresDB } from './postgresDb.js';

export type Db = StyleSyncDB | StyleSyncPostgresDB;

// Shared backend-selection logic used by both the CLI (so `stylesync sync`
// can run against production Postgres when invoked from the GitHub Actions
// worker) and the web app. Chooses Postgres whenever POSTGRES_URL is present
// in the environment (set automatically by Vercel's Neon integration, and
// manually in the worker's repo secrets), otherwise falls back to the local
// SQLite file used by everyday CLI/dev usage.
let instance: Db | undefined;

export function getDb(): Db {
  if (instance) return instance;
  instance = process.env.POSTGRES_URL ? new StyleSyncPostgresDB() : new StyleSyncDB();
  return instance;
}
