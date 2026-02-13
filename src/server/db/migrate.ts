import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { config } from '@server/config'
import * as schema from './schema/index'

function runMigrations() {
  console.warn('Running database migrations...')

  try {
    const sqlite = new Database(config.database.path)
    sqlite.exec('PRAGMA journal_mode = WAL')
    sqlite.exec('PRAGMA foreign_keys = ON')

    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: './drizzle' })

    console.warn('Migrations applied successfully.')
    sqlite.close()
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
