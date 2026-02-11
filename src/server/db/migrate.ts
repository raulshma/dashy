/* eslint-disable no-console */
/**
 * Database Migration Runner
 *
 * Applies pending Drizzle migrations to the SQLite database.
 * Run with: `bun run db:migrate`
 *
 * This script:
 * 1. Connects to the database
 * 2. Applies any pending migrations from the `drizzle/` directory
 * 3. Logs the result
 * 4. Closes the connection
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { closeDatabase, db } from './connection';

function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations applied successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

runMigrations();
