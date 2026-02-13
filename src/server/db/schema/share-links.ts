/**
 * Share Links Schema
 *
 * Tokenized share links for dashboards with read-only or embed access.
 */
import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { dashboards } from './dashboards'

export const shareLinks = sqliteTable('share_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dashboardId: text('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  /** Unique shareable token */
  token: text('token')
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID()),
  /** Access mode: what the share link allows */
  mode: text('mode', { enum: ['read-only', 'embed'] })
    .notNull()
    .default('read-only'),
  /** Optional label for the share link */
  label: text('label'),
  /** Optional expiration date (ISO string); null = never expires */
  expiresAt: text('expires_at'),
  /** Whether this link is currently active */
  isActive: text('is_active').notNull().default('true'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

/** Inferred insert type */
export type InsertShareLink = typeof shareLinks.$inferInsert
/** Inferred select type */
export type SelectShareLink = typeof shareLinks.$inferSelect
