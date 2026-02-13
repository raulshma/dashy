/**
 * Widget Configs Schema
 *
 * Extended key-value configuration for widgets.
 * Allows storing structured settings that don't fit the main JSON blob,
 * such as secrets or separate config sections.
 */
import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { widgets } from './widgets'

export const widgetConfigs = sqliteTable('widget_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  widgetId: text('widget_id')
    .notNull()
    .references(() => widgets.id, { onDelete: 'cascade' }),
  /** Configuration key (e.g., 'apiKey', 'refreshInterval') */
  key: text('key').notNull(),
  /** Configuration value (stored as text; parse as needed) */
  value: text('value').notNull(),
  /** Whether this config value is sensitive and should be masked in UI */
  isSensitive: text('is_sensitive').notNull().default('false'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

/** Inferred insert type */
export type InsertWidgetConfig = typeof widgetConfigs.$inferInsert
/** Inferred select type */
export type SelectWidgetConfig = typeof widgetConfigs.$inferSelect
