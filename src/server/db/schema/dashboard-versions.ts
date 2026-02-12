/**
 * Dashboard Versions Schema
 *
 * Version history for dashboards — stores snapshots for undo/restore.
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { dashboards } from './dashboards'

/** Typed shape of a dashboard version snapshot */
export interface DashboardSnapshot {
  name: string
  description?: string
  pages: Array<{
    name: string
    sortOrder: number
    layout?: { columns?: number; rowHeight?: number; gap?: number }
    widgets: Array<{
      type: string
      title?: string
      x: number
      y: number
      w: number
      h: number
      config: Record<string, unknown>
    }>
  }>
}

export const dashboardVersions = sqliteTable('dashboard_versions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  dashboardId: text('dashboard_id')
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
  /** Auto-incrementing version number per dashboard */
  version: integer('version').notNull(),
  /** Full snapshot of the dashboard state at this version */
  snapshot: text('snapshot', { mode: 'json' })
    .notNull()
    .$type<DashboardSnapshot>(),
  /** Optional description of what changed */
  changeDescription: text('change_description'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

/** Inferred insert type */
export type InsertDashboardVersion = typeof dashboardVersions.$inferInsert
/** Inferred select type */
export type SelectDashboardVersion = typeof dashboardVersions.$inferSelect
