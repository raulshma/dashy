/**
 * Dashboard contract — defines the interface for dashboard operations.
 *
 * Import via: `import type { CreateDashboardInput } from '@shared/contracts'`
 */

/**
 * Input for creating a new dashboard.
 */
export interface CreateDashboardInput {
  name: string
  slug?: string
  description?: string
  isPublic?: boolean
  templateId?: string
}

/**
 * Input for updating an existing dashboard.
 */
export interface UpdateDashboardInput {
  name?: string
  slug?: string
  description?: string
  isPublic?: boolean
}

/**
 * Input for creating a page within a dashboard.
 */
export interface CreatePageInput {
  dashboardId: string
  name: string
  order?: number
}

/**
 * Input for adding a widget to a page.
 */
export interface AddWidgetInput {
  pageId: string
  type: string
  x: number
  y: number
  w: number
  h: number
  config?: Record<string, unknown>
}

/**
 * Input for updating widget position (used in batch layout updates).
 */
export interface UpdateWidgetPositionInput {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Input for creating a share link.
 */
export interface CreateShareLinkInput {
  dashboardId: string
  mode: 'read-only' | 'embed'
  expiresAt?: string
}
