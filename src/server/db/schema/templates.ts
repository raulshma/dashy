/**
 * Templates Schema
 *
 * Dashboard templates that users can create and share.
 * Templates store a full snapshot of dashboard structure.
 */
import { sql } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/** Typed shape of a template's schema payload */
export interface TemplateSchema {
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
      config: Record<string, {}>
    }>
  }>
}

export const templates = sqliteTable('templates', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  /** Full template structure (pages + widgets) */
  schema: text('schema', { mode: 'json' }).notNull().$type<TemplateSchema>(),
  /** Category for organizing templates (e.g., 'homelab', 'developer', 'personal') */
  category: text('category'),
  /** Thumbnail preview URL */
  thumbnailUrl: text('thumbnail_url'),
  createdBy: text('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

/** Inferred insert type */
export type InsertTemplate = typeof templates.$inferInsert
/** Inferred select type */
export type SelectTemplate = typeof templates.$inferSelect
