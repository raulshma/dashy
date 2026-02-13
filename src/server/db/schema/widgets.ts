/**
 * Widgets Schema
 *
 * Individual widget instances placed on pages.
 * Stores widget type, grid position, size, and JSON config.
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { pages } from './pages'

export const widgets = sqliteTable('widgets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pageId: text('page_id')
    .notNull()
    .references(() => pages.id, { onDelete: 'cascade' }),
  /** Widget type key (e.g., 'health-check', 'weather', 'rss') */
  type: text('type').notNull(),
  /** Display title (user-customizable) */
  title: text('title'),
  /** Grid position: column start (0-based) */
  x: integer('x').notNull().default(0),
  /** Grid position: row start (0-based) */
  y: integer('y').notNull().default(0),
  /** Grid span: number of columns */
  w: integer('w').notNull().default(1),
  /** Grid span: number of rows */
  h: integer('h').notNull().default(1),
  /** Widget-specific configuration (JSON) */
  config: text('config', { mode: 'json' })
    .notNull()
    .$type<Record<string, {}>>()
    .default({}),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

/** Inferred insert type */
export type InsertWidget = typeof widgets.$inferInsert
/** Inferred select type */
export type SelectWidget = typeof widgets.$inferSelect
