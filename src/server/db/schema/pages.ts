/**
 * Pages Schema
 *
 * Multi-page support within dashboards.
 * Each dashboard can have multiple pages with ordered layout.
 */
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { dashboards } from './dashboards';

export const pages = sqliteTable('pages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dashboardId: text('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Untitled Page'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  /** JSON column for page-level layout config (columns, gaps, etc.) */
  layout: text('layout', { mode: 'json' }).$type<{
    columns?: number;
    rowHeight?: number;
    gap?: number;
  }>(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
});

/** Inferred insert type */
export type InsertPage = typeof pages.$inferInsert;
/** Inferred select type */
export type SelectPage = typeof pages.$inferSelect;
