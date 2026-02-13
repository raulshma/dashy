/**
 * Database Connection Module
 *
 * Singleton SQLite connection using better-sqlite3 with Drizzle ORM.
 * Configures WAL mode for better concurrent read performance and
 * applies performance-oriented PRAGMAs.
 *
 * Usage:
 *   import { db } from '@server/db/connection'
 *   const users = await db.select().from(usersTable)
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import { config } from '@server/config'
import * as schema from './schema/index'

interface DatabaseSchemaValidationResult {
  ok: boolean
  missingTables: Array<string>
  missingColumns: Array<{ table: string; column: string }>
}

const expectedSchema: Record<string, Array<string>> = {
  users: [
    'id',
    'email',
    'password_hash',
    'display_name',
    'avatar_url',
    'is_active',
    'created_at',
    'updated_at',
  ],
  dashboards: [
    'id',
    'user_id',
    'name',
    'slug',
    'description',
    'is_public',
    'is_default',
    'icon',
    'deleted_at',
    'created_at',
    'updated_at',
  ],
  pages: [
    'id',
    'dashboard_id',
    'name',
    'icon',
    'sort_order',
    'layout',
    'created_at',
    'updated_at',
  ],
  widgets: [
    'id',
    'page_id',
    'type',
    'title',
    'x',
    'y',
    'w',
    'h',
    'config',
    'created_at',
    'updated_at',
  ],
  widget_configs: [
    'id',
    'widget_id',
    'key',
    'value',
    'is_sensitive',
    'created_at',
  ],
  templates: [
    'id',
    'name',
    'description',
    'schema',
    'category',
    'thumbnail_url',
    'created_by',
    'created_at',
    'updated_at',
  ],
  share_links: [
    'id',
    'dashboard_id',
    'token',
    'mode',
    'label',
    'expires_at',
    'is_active',
    'created_at',
  ],
  dashboard_versions: [
    'id',
    'dashboard_id',
    'version',
    'snapshot',
    'change_description',
    'created_at',
  ],
  plugins: [
    'id',
    'name',
    'version',
    'description',
    'author_name',
    'author_email',
    'author_url',
    'license',
    'repository',
    'homepage',
    'main',
    'types',
    'icon',
    'screenshots',
    'keywords',
    'engines_dashy',
    'permissions',
    'network_allowlist',
    'contributes',
    'activation_events',
    'deprecated',
    'installed_by',
    'install_source',
    'install_path',
    'checksum',
    'installed_at',
    'state',
    'last_activated',
    'last_deactivated',
    'error_message',
    'error_stack',
    'error_timestamp',
    'granted_permissions',
    'denied_permissions',
    'created_at',
    'updated_at',
  ],
  plugin_storage: [
    'id',
    'plugin_id',
    'key',
    'value',
    'created_at',
    'updated_at',
  ],
}

/**
 * Create the underlying better-sqlite3 instance with PRAGMAs.
 */
function createSqliteInstance(): Database.Database {
  const sqlite = new Database(config.database.path)

  // ── Performance PRAGMAs ──────────────────────────
  // WAL mode: allows concurrent readers while writing
  sqlite.pragma('journal_mode = WAL')
  // Synchronous NORMAL: good balance between safety and speed
  sqlite.pragma('synchronous = NORMAL')
  // Enable foreign key enforcement (off by default in SQLite)
  sqlite.pragma('foreign_keys = ON')
  // Increase cache size (negative = KiB, -64000 ≈ 64 MB)
  sqlite.pragma('cache_size = -64000')
  // Memory-map up to 256 MB for I/O performance
  sqlite.pragma('mmap_size = 268435456')
  // Busy timeout: wait up to 5s when the DB is locked
  sqlite.pragma('busy_timeout = 5000')
  // Temp store in memory for faster temp table operations
  sqlite.pragma('temp_store = MEMORY')

  return sqlite
}

/**
 * Validate that required tables/columns exist in the SQLite schema.
 */
export function validateDatabaseSchema(): DatabaseSchemaValidationResult {
  const tableRows = sqlite
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    )
    .all() as Array<{ name: string }>

  const existingTables = new Set(tableRows.map((row) => row.name))
  const missingTables: Array<string> = []
  const missingColumns: Array<{ table: string; column: string }> = []

  for (const [table, expectedColumns] of Object.entries(expectedSchema)) {
    if (!existingTables.has(table)) {
      missingTables.push(table)
      continue
    }

    const pragmaRows = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>
    const existingColumns = new Set(pragmaRows.map((row) => row.name))

    for (const column of expectedColumns) {
      if (!existingColumns.has(column)) {
        missingColumns.push({ table, column })
      }
    }
  }

  return {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  }
}

function assertDatabaseSchemaOnStartup(): void {
  const skipValidation =
    process.env.SKIP_DB_SCHEMA_VALIDATION === '1' ||
    process.argv.some((arg) =>
      /drizzle|migrate|seed|db:|typecheck|lint|test|build/i.test(arg),
    )

  if (skipValidation) {
    return
  }

  const result = validateDatabaseSchema()
  if (result.ok) {
    return
  }

  const missingTablesMessage =
    result.missingTables.length > 0
      ? `Missing tables: ${result.missingTables.join(', ')}`
      : null
  const missingColumnsMessage =
    result.missingColumns.length > 0
      ? `Missing columns: ${result.missingColumns
          .map((item) => `${item.table}.${item.column}`)
          .join(', ')}`
      : null

  const details = [missingTablesMessage, missingColumnsMessage]
    .filter(Boolean)
    .join('\n')

  throw new Error(
    [
      '❌ Database schema validation failed on startup.',
      details,
      'Run database migrations before starting the app.',
      'Hint: bun run db:migrate',
      'To skip this check temporarily, set SKIP_DB_SCHEMA_VALIDATION=1.',
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

/** The raw better-sqlite3 instance */
const sqlite = createSqliteInstance()

// Validate DB schema at process startup (with explicit skip controls).
assertDatabaseSchemaOnStartup()

/**
 * The Drizzle ORM database instance.
 * All application queries should go through this object.
 *
 * Schema is passed so Drizzle can infer relations for the relational query API.
 */
export const db = drizzle({ client: sqlite, schema })

/**
 * Check database health by running a simple query.
 * Returns true if the database is responsive.
 */
export function isDatabaseHealthy(): boolean {
  try {
    db.run(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

/**
 * Gracefully close the database connection.
 */
export function closeDatabase(): void {
  sqlite.close()
}
