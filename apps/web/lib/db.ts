import 'server-only';
import { StyleSyncDB } from '@stylesync/core/db';
import { StyleSyncPostgresDB } from '@stylesync/core/postgres-db';

// Local `pnpm web dev` and the CLI both read/write a single SQLite file —
// synchronous, zero-ops, exactly per spec. But a *deployed* instance (Vercel)
// runs on a read-only serverless filesystem, so it instead talks to a real
// Postgres database (Vercel Postgres/Neon) whenever POSTGRES_URL is present.
// Both classes expose the same method names; call sites always `await` so it
// doesn't matter which implementation is behind `getDb()`.
export type Db = StyleSyncDB | StyleSyncPostgresDB;

let instance: Db | undefined;

export function getDb(): Db {
    if (instance) return instance;
    instance = process.env.POSTGRES_URL ? new StyleSyncPostgresDB() : new StyleSyncDB();
    return instance;
}
