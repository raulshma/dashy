/**
 * Dashboard validation schemas (Zod).
 *
 * Used for server-side validation of inputs across server functions.
 * Import via: `import { createDashboardSchema } from '@shared/schemas'`
 */
import { z } from 'zod'

/**
 * Schema for creating a new dashboard.
 */
export const createDashboardSchema = z.object({
  name: z
    .string()
    .min(1, 'Dashboard name is required')
    .max(100, 'Dashboard name must be 100 characters or fewer'),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase alphanumeric with hyphens',
    )
    .max(100)
    .optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  templateId: z.string().uuid().optional(),
})

/**
 * Schema for updating an existing dashboard.
 */
export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
})

/**
 * Schema for creating a page within a dashboard.
 */
export const createPageSchema = z.object({
  dashboardId: z.string().uuid('Invalid dashboard ID'),
  name: z.string().min(1, 'Page name is required').max(100),
  order: z.number().int().min(0).optional(),
})

/**
 * Pagination query schema.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Schema for adding a widget to a page.
 */
export const addWidgetSchema = z.object({
  pageId: z.string().uuid('Invalid page ID'),
  type: z.string().min(1, 'Widget type is required'),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
})

/**
 * Schema for updating a widget's position (batch layout update).
 */
export const updateWidgetPositionSchema = z.object({
  id: z.string().uuid(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})

/**
 * Schema for batch position updates.
 */
export const batchUpdatePositionsSchema = z.object({
  positions: z.array(updateWidgetPositionSchema).min(1),
})

/**
 * Schema for creating a share link.
 */
export const createShareLinkSchema = z.object({
  dashboardId: z.string().uuid(),
  mode: z.enum(['read-only', 'embed']),
  expiresAt: z.string().datetime().optional(),
})

/**
 * Schema for user registration.
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or fewer'),
})

/**
 * Schema for user login.
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
