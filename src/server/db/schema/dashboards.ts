/**
 * Dashboards Schema
 *
 * User-owned dashboards — the primary container for pages and widgets.
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

export const dashboards = sqliteTable('dashboards', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  isDefault: integer('is_default', { mode: 'boolean' })
    .notNull()
    .default(false),
  icon: text('icon'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

/** Inferred insert type */
export type InsertDashboard = typeof dashboards.$inferInsert
/** Inferred select type */
export type SelectDashboard = typeof dashboards.$inferSelect
