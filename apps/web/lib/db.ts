import 'server-only';
import { StyleSyncDB } from '@stylesync/core/db';

// One connection per server process — better-sqlite3 is synchronous and fine
// to share across requests in a single Next.js server (this is a localhost,
// single-user tool; there is no connection-pooling problem to solve).
let instance: StyleSyncDB | undefined;

export function getDb(): StyleSyncDB {
  instance ??= new StyleSyncDB();
  return instance;
}
