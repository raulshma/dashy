/**
 * Dashboard Server Functions
 *
 * Full CRUD operations for dashboards owned by the authenticated user.
 * All endpoints require authentication via `protectedGetFn` / `protectedPostFn`.
 *
 * Usage:
 *   import { createDashboardFn, listDashboardsFn, ... } from '@server/api/dashboards'
 */
import { and, asc, count, desc, eq, inArray, isNull, like } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import { dashboards, pages, widgets } from '@server/db/schema'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ConflictError,
  ForbiddenError,
  generateSlug,
  handleServerError,
  NotFoundError,
  ValidationError,
} from '@server/api/utils'
import {
  createDashboardSchema,
  paginationSchema,
  updateDashboardSchema,
} from '@shared/schemas'
import { createPaginatedResponse } from '@shared/types'
import type { SelectDashboard } from '@server/db/schema'
import type { ApiResponse, PaginatedResponse } from '@shared/types'

// ─── Types ─────────────────────────────────────────

/** Dashboard with page and widget counts for list views */
export interface DashboardSummary {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  isPublic: boolean
  isDefault: boolean
  pageCount: number
  widgetCount: number
  createdAt: string
  updatedAt: string
}

/** Dashboard detail including nested pages */
export interface DashboardDetail extends Omit<
  SelectDashboard,
  'userId' | 'deletedAt'
> {
  pages: Array<{
    id: string
    name: string
    icon: string | null
    sortOrder: number
    widgetCount: number
    widgets?: Array<{
      id: string
      type: string
      title: string | null
      config: Record<string, {}>
      x: number
      y: number
      w: number
      h: number
    }>
  }>
}

// ─── Helpers ───────────────────────────────────────

/**
 * Ensure a slug is unique for the given user, appending a random suffix if needed.
 */
async function ensureUniqueSlug(
  baseSlug: string,
  userId: string,
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug
  let attempt = 0

  while (attempt < 10) {
    const existing = await db
      .select({ id: dashboards.id })
      .from(dashboards)
      .where(
        and(
          eq(dashboards.slug, slug),
          eq(dashboards.userId, userId),
          isNull(dashboards.deletedAt),
          excludeId ? undefined : undefined,
        ),
      )
      .limit(1)

    // If slug belongs to the dashboard we're updating, it's fine
    if (existing.length === 0 || (excludeId && existing[0]?.id === excludeId)) {
      return slug
    }

    attempt++
    const suffix = Math.random().toString(36).substring(2, 6)
    slug = `${baseSlug}-${suffix}`
  }

  throw new ConflictError('Unable to generate unique slug')
}

/**
 * Verify a dashboard belongs to the current user and is not soft-deleted.
 */
async function getOwnedDashboard(
  dashboardId: string,
  userId: string,
): Promise<SelectDashboard> {
  const [dashboard] = await db
    .select()
    .from(dashboards)
    .where(and(eq(dashboards.id, dashboardId), isNull(dashboards.deletedAt)))
    .limit(1)

  if (!dashboard) {
    throw new NotFoundError('Dashboard', dashboardId)
  }

  if (dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this dashboard')
  }

  return dashboard
}

// ─── Create Dashboard ──────────────────────────────

/**
 * Create a new dashboard for the authenticated user.
 *
 * Generates a slug from the name if not provided.
 * Creates a default first page within the dashboard.
 */
export const createDashboardFn = protectedPostFn
  .inputValidator(createDashboardSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<DashboardDetail>> => {
    try {
      const userId = context.user.id

      // Generate or validate slug
      const baseSlug = data.slug ?? generateSlug(data.name)
      if (!baseSlug) {
        throw new ValidationError(
          'Could not generate a valid slug from the dashboard name',
        )
      }
      const slug = await ensureUniqueSlug(baseSlug, userId)

      // Check if this is the user's first dashboard → make it default
      const [existingCount] = await db
        .select({ count: count() })
        .from(dashboards)
        .where(and(eq(dashboards.userId, userId), isNull(dashboards.deletedAt)))
      const isFirst = (existingCount?.count ?? 0) === 0

      // Insert dashboard
      const [newDashboard] = await db
        .insert(dashboards)
        .values({
          userId,
          name: data.name,
          slug,
          description: data.description ?? null,
          isPublic: data.isPublic ?? false,
          isDefault: isFirst,
        })
        .returning()

      if (!newDashboard) {
        throw new Error('Failed to create dashboard')
      }

      // Create default first page
      const [defaultPage] = await db
        .insert(pages)
        .values({
          dashboardId: newDashboard.id,
          name: 'Home',
          sortOrder: 0,
        })
        .returning()

      return {
        success: true,
        data: {
          id: newDashboard.id,
          name: newDashboard.name,
          slug: newDashboard.slug,
          description: newDashboard.description,
          icon: newDashboard.icon,
          isPublic: newDashboard.isPublic,
          isDefault: newDashboard.isDefault,
          createdAt: newDashboard.createdAt,
          updatedAt: newDashboard.updatedAt,
          pages: defaultPage
            ? [
                {
                  id: defaultPage.id,
                  name: defaultPage.name,
                  icon: defaultPage.icon,
                  sortOrder: defaultPage.sortOrder,
                  widgetCount: 0,
                },
              ]
            : [],
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── List Dashboards ───────────────────────────────

const listDashboardsInputSchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * List dashboards for the authenticated user with pagination and search.
 */
export const listDashboardsFn = protectedGetFn
  .inputValidator(listDashboardsInputSchema)
  .handler(
    async ({
      data,
      context,
    }): Promise<ApiResponse<PaginatedResponse<DashboardSummary>>> => {
      try {
        const userId = context.user.id
        const { page, limit, search, sortBy, sortDir } = data
        const offset = (page - 1) * limit

        // Build where conditions
        const whereConditions = and(
          eq(dashboards.userId, userId),
          isNull(dashboards.deletedAt),
          search ? like(dashboards.name, `%${search}%`) : undefined,
        )

        // Get total count
        const [totalResult] = await db
          .select({ count: count() })
          .from(dashboards)
          .where(whereConditions)
        const total = totalResult?.count ?? 0

        // Determine sort column
        const sortColumn =
          sortBy === 'name'
            ? dashboards.name
            : sortBy === 'createdAt'
              ? dashboards.createdAt
              : dashboards.updatedAt

        const sortFn = sortDir === 'asc' ? asc : desc

        // Fetch dashboards
        const dashboardRows = await db
          .select()
          .from(dashboards)
          .where(whereConditions)
          .orderBy(sortFn(sortColumn))
          .limit(limit)
          .offset(offset)

        // Get page and widget counts for each dashboard
        const summaries: Array<DashboardSummary> = await Promise.all(
          dashboardRows.map(async (d) => {
            const [pageCount] = await db
              .select({ count: count() })
              .from(pages)
              .where(eq(pages.dashboardId, d.id))

            const [widgetCount] = await db
              .select({ count: count() })
              .from(widgets)
              .innerJoin(pages, eq(widgets.pageId, pages.id))
              .where(eq(pages.dashboardId, d.id))

            return {
              id: d.id,
              name: d.name,
              slug: d.slug,
              description: d.description,
              icon: d.icon,
              isPublic: d.isPublic,
              isDefault: d.isDefault,
              pageCount: pageCount?.count ?? 0,
              widgetCount: widgetCount?.count ?? 0,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            }
          }),
        )

        return {
          success: true,
          data: createPaginatedResponse(summaries, total, { page, limit }),
        }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

// ─── Get Dashboard by ID or Slug ───────────────────

const getDashboardInputSchema = z.object({
  /** Either a UUID or a slug */
  identifier: z.string().min(1),
  /** Include widget metadata for each page (used by search index / editor tooling) */
  includeWidgets: z.boolean().default(false),
})

/**
 * Get a single dashboard by ID or slug.
 * Includes pages with their widget counts.
 */
export const getDashboardFn = protectedGetFn
  .inputValidator(getDashboardInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<DashboardDetail>> => {
    try {
      const userId = context.user.id
      const { identifier, includeWidgets } = data

      // Try by ID first, then by slug
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          identifier,
        )

      const [dashboard] = await db
        .select()
        .from(dashboards)
        .where(
          and(
            isUuid
              ? eq(dashboards.id, identifier)
              : eq(dashboards.slug, identifier),
            isNull(dashboards.deletedAt),
          ),
        )
        .limit(1)

      if (!dashboard) {
        throw new NotFoundError('Dashboard', identifier)
      }

      // Allow access if owner or if public
      if (dashboard.userId !== userId && !dashboard.isPublic) {
        throw new ForbiddenError('You do not have access to this dashboard')
      }

      // Fetch pages with widget counts
      const dashboardPages = await db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, dashboard.id))
        .orderBy(asc(pages.sortOrder))

      const pageIds = dashboardPages.map((p) => p.id)

      const widgetsByPage = new Map<
        string,
        Array<{
          id: string
          type: string
          title: string | null
          config: Record<string, {}>
          x: number
          y: number
          w: number
          h: number
        }>
      >()

      if (includeWidgets && pageIds.length > 0) {
        const dashboardWidgets = await db
          .select({
            id: widgets.id,
            pageId: widgets.pageId,
            type: widgets.type,
            title: widgets.title,
            config: widgets.config,
            x: widgets.x,
            y: widgets.y,
            w: widgets.w,
            h: widgets.h,
          })
          .from(widgets)
          .where(inArray(widgets.pageId, pageIds))

        for (const widget of dashboardWidgets) {
          const pageWidgets = widgetsByPage.get(widget.pageId) ?? []
          pageWidgets.push({
            id: widget.id,
            type: widget.type,
            title: widget.title,
            config: widget.config,
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
          })
          widgetsByPage.set(widget.pageId, pageWidgets)
        }
      }

      const pagesWithCounts = await Promise.all(
        dashboardPages.map(async (p) => {
          const pageWidgets = widgetsByPage.get(p.id) ?? []
          const widgetCount = includeWidgets
            ? pageWidgets.length
            : ((
                await db
                  .select({ count: count() })
                  .from(widgets)
                  .where(eq(widgets.pageId, p.id))
                  .limit(1)
              )[0]?.count ?? 0)

          return {
            id: p.id,
            name: p.name,
            icon: p.icon,
            sortOrder: p.sortOrder,
            widgetCount,
            widgets: includeWidgets ? pageWidgets : undefined,
          }
        }),
      )

      return {
        success: true,
        data: {
          id: dashboard.id,
          name: dashboard.name,
          slug: dashboard.slug,
          description: dashboard.description,
          icon: dashboard.icon,
          isPublic: dashboard.isPublic,
          isDefault: dashboard.isDefault,
          createdAt: dashboard.createdAt,
          updatedAt: dashboard.updatedAt,
          pages: pagesWithCounts,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Update Dashboard ──────────────────────────────

const updateDashboardInputSchema = z.object({
  id: z.string().min(1),
  ...updateDashboardSchema.shape,
})

/**
 * Update a dashboard's name, slug, description, or visibility.
 */
export const updateDashboardFn = protectedPostFn
  .inputValidator(updateDashboardInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<DashboardDetail>> => {
    try {
      const userId = context.user.id
      const { id, ...updates } = data

      // Verify ownership
      await getOwnedDashboard(id, userId)

      const updateValues: Record<string, unknown> = {}

      if (updates.name !== undefined) {
        updateValues.name = updates.name
      }

      if (updates.slug !== undefined) {
        const slug = await ensureUniqueSlug(updates.slug, userId, id)
        updateValues.slug = slug
      }

      if (updates.description !== undefined) {
        updateValues.description = updates.description
      }

      if (updates.isPublic !== undefined) {
        updateValues.isPublic = updates.isPublic
      }

      if (Object.keys(updateValues).length === 0) {
        throw new ValidationError('No changes provided')
      }

      // Apply update
      const [updated] = await db
        .update(dashboards)
        .set(updateValues)
        .where(eq(dashboards.id, id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update dashboard')
      }

      // Fetch pages for the response
      const dashboardPages = await db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, id))
        .orderBy(asc(pages.sortOrder))

      const pagesWithCounts = await Promise.all(
        dashboardPages.map(async (p) => {
          const [wCount] = await db
            .select({ count: count() })
            .from(widgets)
            .where(eq(widgets.pageId, p.id))

          return {
            id: p.id,
            name: p.name,
            icon: p.icon,
            sortOrder: p.sortOrder,
            widgetCount: wCount?.count ?? 0,
          }
        }),
      )

      return {
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          icon: updated.icon,
          isPublic: updated.isPublic,
          isDefault: updated.isDefault,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          pages: pagesWithCounts,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Delete Dashboard ──────────────────────────────

const deleteDashboardInputSchema = z.object({
  id: z.string().min(1),
  /** If true, permanently deletes. Otherwise soft-deletes (sets deletedAt). */
  permanent: z.boolean().default(false),
})

/**
 * Delete a dashboard. Supports soft delete (default) and permanent delete.
 * Permanent delete cascades to pages, widgets, and configs via FK constraints.
 */
export const deleteDashboardFn = protectedPostFn
  .inputValidator(deleteDashboardInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<{ deleted: boolean }>> => {
      try {
        const userId = context.user.id
        const { id, permanent } = data

        // Verify ownership
        const dashboard = await getOwnedDashboard(id, userId)

        if (permanent) {
          // Hard delete — cascades through FK constraints
          await db.delete(dashboards).where(eq(dashboards.id, id))
        } else {
          // Soft delete — set deletedAt
          await db
            .update(dashboards)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(dashboards.id, id))
        }

        // If the deleted dashboard was default, promote another
        if (dashboard.isDefault) {
          const [nextDashboard] = await db
            .select({ id: dashboards.id })
            .from(dashboards)
            .where(
              and(eq(dashboards.userId, userId), isNull(dashboards.deletedAt)),
            )
            .orderBy(asc(dashboards.createdAt))
            .limit(1)

          if (nextDashboard) {
            await db
              .update(dashboards)
              .set({ isDefault: true })
              .where(eq(dashboards.id, nextDashboard.id))
          }
        }

        return { success: true, data: { deleted: true } }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

// ─── Duplicate Dashboard ───────────────────────────

const duplicateDashboardInputSchema = z.object({
  id: z.string().min(1),
  /** Optional new name for the clone */
  name: z.string().min(1).max(100).optional(),
})

/**
 * Deep-clone a dashboard: dashboard → pages → widgets.
 * Creates new UUIDs for all entities.
 */
export const duplicateDashboardFn = protectedPostFn
  .inputValidator(duplicateDashboardInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<DashboardDetail>> => {
    try {
      const userId = context.user.id
      const { id, name } = data

      // Verify ownership
      const source = await getOwnedDashboard(id, userId)

      // Generate new name and slug
      const newName = name ?? `${source.name} (Copy)`
      const baseSlug = generateSlug(newName)
      const slug = await ensureUniqueSlug(baseSlug, userId)

      // Clone dashboard
      const [clonedDashboard] = await db
        .insert(dashboards)
        .values({
          userId,
          name: newName,
          slug,
          description: source.description,
          icon: source.icon,
          isPublic: false, // Clones start private
          isDefault: false,
        })
        .returning()

      if (!clonedDashboard) {
        throw new Error('Failed to duplicate dashboard')
      }

      // Fetch source pages
      const sourcePages = await db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, id))
        .orderBy(asc(pages.sortOrder))

      const clonedPages: Array<{
        id: string
        name: string
        icon: string | null
        sortOrder: number
        widgetCount: number
      }> = []

      for (const sourcePage of sourcePages) {
        // Clone page
        const [clonedPage] = await db
          .insert(pages)
          .values({
            dashboardId: clonedDashboard.id,
            name: sourcePage.name,
            icon: sourcePage.icon,
            sortOrder: sourcePage.sortOrder,
            layout: sourcePage.layout,
          })
          .returning()

        if (!clonedPage) continue

        // Fetch source widgets for this page
        const sourceWidgets = await db
          .select()
          .from(widgets)
          .where(eq(widgets.pageId, sourcePage.id))

        // Clone widgets
        let widgetCount = 0
        for (const sourceWidget of sourceWidgets) {
          await db.insert(widgets).values({
            pageId: clonedPage.id,
            type: sourceWidget.type,
            title: sourceWidget.title,
            x: sourceWidget.x,
            y: sourceWidget.y,
            w: sourceWidget.w,
            h: sourceWidget.h,
            config: sourceWidget.config,
          })
          widgetCount++
        }

        clonedPages.push({
          id: clonedPage.id,
          name: clonedPage.name,
          icon: clonedPage.icon,
          sortOrder: clonedPage.sortOrder,
          widgetCount,
        })
      }

      return {
        success: true,
        data: {
          id: clonedDashboard.id,
          name: clonedDashboard.name,
          slug: clonedDashboard.slug,
          description: clonedDashboard.description,
          icon: clonedDashboard.icon,
          isPublic: clonedDashboard.isPublic,
          isDefault: clonedDashboard.isDefault,
          createdAt: clonedDashboard.createdAt,
          updatedAt: clonedDashboard.updatedAt,
          pages: clonedPages,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
