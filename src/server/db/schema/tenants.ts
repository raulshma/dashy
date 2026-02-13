/**
 * Tenants Schema
 *
 * Organization/workspace isolation for multi-tenant support.
 * Each tenant represents a separate organization with its own users and data.
 *
 * Note: This is preparation for future multi-tenant expansion.
 * Currently, the application uses user-level isolation.
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const tenants = sqliteTable('tenants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),
  maxUsers: integer('max_users').notNull().default(5),
  maxDashboards: integer('max_dashboards').notNull().default(10),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  settings: text('settings', { mode: 'json' }).$type<{
    allowedWidgetTypes?: Array<string>
    customBranding?: {
      primaryColor?: string
      logoUrl?: string
      faviconUrl?: string
    }
    features?: Record<string, boolean>
  }>(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdate(() => new Date().toISOString()),
})

export const tenantMemberships = sqliteTable('tenant_memberships', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('member'),
  invitedBy: text('invited_by'),
  joinedAt: text('joined_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

export type Tenant = typeof tenants.$inferSelect
export type InsertTenant = typeof tenants.$inferInsert
export type TenantMembership = typeof tenantMemberships.$inferSelect
export type InsertTenantMembership = typeof tenantMemberships.$inferInsert

export type TenantPlan = 'free' | 'pro' | 'enterprise'
export type TenantRole = 'owner' | 'admin' | 'member' | 'viewer'
