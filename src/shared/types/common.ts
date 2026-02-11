/**
 * Represents a database entity with common timestamp fields.
 */
export interface BaseEntity {
  /** Unique identifier */
  id: string
  /** Creation timestamp (ISO 8601) */
  createdAt: string
  /** Last update timestamp (ISO 8601) */
  updatedAt: string
}

/**
 * Represents a user in the system.
 */
export interface User extends BaseEntity {
  email: string
  displayName: string
}

/**
 * Represents a dashboard owned by a user.
 */
export interface Dashboard extends BaseEntity {
  userId: string
  name: string
  slug: string
  description?: string
  isPublic: boolean
}

/**
 * Represents a page within a dashboard.
 */
export interface Page extends BaseEntity {
  dashboardId: string
  name: string
  order: number
  layout?: string
}

/**
 * Represents a widget placed on a page.
 */
export interface Widget extends BaseEntity {
  pageId: string
  type: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
}

/**
 * Represents an extended key-value config entry for a widget.
 */
export interface WidgetConfig {
  id: string
  widgetId: string
  key: string
  value: string
}

/**
 * Represents a dashboard template.
 */
export interface Template extends BaseEntity {
  name: string
  description?: string
  schema: Record<string, unknown>
  createdBy: string
}

/**
 * Represents a share link for a dashboard.
 */
export interface ShareLink extends BaseEntity {
  dashboardId: string
  token: string
  mode: ShareLinkMode
  expiresAt?: string
}

/**
 * The access mode of a share link.
 */
export type ShareLinkMode = 'read-only' | 'embed'

/**
 * Represents a version snapshot of a dashboard.
 */
export interface DashboardVersion extends BaseEntity {
  dashboardId: string
  version: number
  snapshot: Record<string, unknown>
}
