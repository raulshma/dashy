/**
 * Plugins Schema
 *
 * Stores installed plugins with their manifests and status.
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

export const plugins = sqliteTable('plugins', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description').notNull(),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email'),
  authorUrl: text('author_url'),
  license: text('license').notNull(),
  repository: text('repository'),
  homepage: text('homepage'),
  main: text('main').notNull(),
  types: text('types'),
  icon: text('icon'),
  screenshots: text('screenshots'),
  keywords: text('keywords'),
  enginesDashy: text('engines_dashy').notNull(),
  permissions: text('permissions').notNull().default('[]'),
  networkAllowlist: text('network_allowlist'),
  contributes: text('contributes'),
  activationEvents: text('activation_events'),
  deprecated: integer('deprecated', { mode: 'boolean' }).default(false),
  installedBy: text('installed_by')
    .notNull()
    .references(() => users.id, { onDelete: 'set null' }),
  installSource: text('install_source', {
    enum: ['local', 'npm', 'url', 'marketplace'],
  }).notNull(),
  installPath: text('install_path').notNull(),
  checksum: text('checksum'),
  installedAt: text('installed_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  state: text('state', {
    enum: [
      'installed',
      'activating',
      'running',
      'deactivating',
      'disabled',
      'error',
    ],
  })
    .notNull()
    .default('installed'),
  lastActivated: text('last_activated'),
  lastDeactivated: text('last_deactivated'),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  errorTimestamp: text('error_timestamp'),
  grantedPermissions: text('granted_permissions').notNull().default('[]'),
  deniedPermissions: text('denied_permissions').notNull().default('[]'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

export type InsertPlugin = typeof plugins.$inferInsert
export type SelectPlugin = typeof plugins.$inferSelect

export const pluginStorage = sqliteTable('plugin_storage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  pluginId: text('plugin_id')
    .notNull()
    .references(() => plugins.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

export type InsertPluginStorage = typeof pluginStorage.$inferInsert
export type SelectPluginStorage = typeof pluginStorage.$inferSelect
