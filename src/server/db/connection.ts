/**
 * Database Connection Module
 *
 * Singleton SQLite connection using Bun's built-in SQLite with Drizzle ORM.
 * Configures WAL mode for better concurrent read performance and
 * applies performance-oriented PRAGMAs.
 *
 * Usage:
 *   import { db } from '@server/db/connection'
 *   const users = await db.select().from(usersTable)
 */
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { sql } from 'drizzle-orm';
import { config } from '@server/config';
import * as schema from './schema/index';

/**
 * Create the underlying Bun SQLite instance with PRAGMAs.
 */
function createSqliteInstance(): Database {
  const sqlite = new Database(config.database.path, { create: true });

  // ── Performance PRAGMAs ──────────────────────────
  // WAL mode: allows concurrent readers while writing
  sqlite.exec('PRAGMA journal_mode = WAL');
  // Synchronous NORMAL: good balance between safety and speed
  sqlite.exec('PRAGMA synchronous = NORMAL');
  // Enable foreign key enforcement (off by default in SQLite)
  sqlite.exec('PRAGMA foreign_keys = ON');
  // Increase cache size (negative = KiB, -64000 ≈ 64 MB)
  sqlite.exec('PRAGMA cache_size = -64000');
  // Memory-map up to 256 MB for I/O performance
  sqlite.exec('PRAGMA mmap_size = 268435456');
  // Busy timeout: wait up to 5s when the DB is locked
  sqlite.exec('PRAGMA busy_timeout = 5000');
  // Temp store in memory for faster temp table operations
  sqlite.exec('PRAGMA temp_store = MEMORY');

  return sqlite;
}

/** The raw Bun SQLite instance */
const sqlite = createSqliteInstance();

/**
 * The Drizzle ORM database instance.
 * All application queries should go through this object.
 *
 * Schema is passed so Drizzle can infer relations for the relational query API.
 */
export const db = drizzle({ client: sqlite, schema });

/**
 * Check database health by running a simple query.
 * Returns true if the database is responsive.
 */
export function isDatabaseHealthy(): boolean {
  try {
    db.run(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close the database connection.
 */
export function closeDatabase(): void {
  sqlite.close();
}
