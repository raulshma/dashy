/**
 * Page Server Functions
 *
 * CRUD operations for pages within dashboards.
 * Supports creating, reordering, renaming, and deleting pages.
 *
 * Usage:
 *   import { addPageFn, reorderPagesFn, deletePageFn } from '@server/api/pages'
 */
import { asc, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import { dashboards, pages, widgets } from '@server/db/schema'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ForbiddenError,
  handleServerError,
  NotFoundError,
  ValidationError,
} from '@server/api/utils'
import type { ApiResponse } from '@shared/types'

// ─── Types ─────────────────────────────────────────

export interface PageDetail {
  id: string
  dashboardId: string
  name: string
  icon: string | null
  sortOrder: number
  layout: {
    columns?: number
    rowHeight?: number
    gap?: number
  } | null
  widgetCount: number
  createdAt: string
  updatedAt: string
}

// ─── Helpers ───────────────────────────────────────

async function verifyDashboardOwnership(
  dashboardId: string,
  userId: string,
): Promise<void> {
  const [dashboard] = await db
    .select({ id: dashboards.id, userId: dashboards.userId })
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId))
    .limit(1)

  if (!dashboard) {
    throw new NotFoundError('Dashboard', dashboardId)
  }

  if (dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this dashboard')
  }
}

async function verifyPageOwnership(
  pageId: string,
  userId: string,
): Promise<{ pageId: string; dashboardId: string }> {
  const [page] = await db
    .select({
      id: pages.id,
      dashboardId: pages.dashboardId,
    })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1)

  if (!page) {
    throw new NotFoundError('Page', pageId)
  }

  await verifyDashboardOwnership(page.dashboardId, userId)

  return { pageId: page.id, dashboardId: page.dashboardId }
}

// ─── Add Page ──────────────────────────────────────

const addPageInputSchema = z.object({
  dashboardId: z.string().min(1),
  name: z
    .string()
    .min(1, 'Page name is required')
    .max(100)
    .default('Untitled Page'),
  icon: z.string().max(50).optional(),
})

/**
 * Add a new page to a dashboard.
 * The page is appended at the end (highest sort order + 1).
 */
export const addPageFn = protectedPostFn
  .inputValidator(addPageInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<PageDetail>> => {
    try {
      const userId = context.user.id
      await verifyDashboardOwnership(data.dashboardId, userId)

      // Determine next sort order
      const existingPages = await db
        .select({ sortOrder: pages.sortOrder })
        .from(pages)
        .where(eq(pages.dashboardId, data.dashboardId))
        .orderBy(asc(pages.sortOrder))

      const nextOrder =
        existingPages.length > 0
          ? Math.max(...existingPages.map((p) => p.sortOrder)) + 1
          : 0

      // Insert page
      const [newPage] = await db
        .insert(pages)
        .values({
          dashboardId: data.dashboardId,
          name: data.name,
          icon: data.icon ?? null,
          sortOrder: nextOrder,
        })
        .returning()

      if (!newPage) {
        throw new Error('Failed to create page')
      }

      return {
        success: true,
        data: {
          id: newPage.id,
          dashboardId: newPage.dashboardId,
          name: newPage.name,
          icon: newPage.icon,
          sortOrder: newPage.sortOrder,
          layout: newPage.layout,
          widgetCount: 0,
          createdAt: newPage.createdAt,
          updatedAt: newPage.updatedAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Reorder Pages ─────────────────────────────────

const reorderPagesInputSchema = z.object({
  dashboardId: z.string().min(1),
  /** Ordered array of page IDs — the index becomes the new sort order */
  pageIds: z.array(z.string().min(1)).min(1),
})

/**
 * Reorder pages within a dashboard.
 * Accepts an ordered array of page IDs; their position becomes the new sort order.
 */
export const reorderPagesFn = protectedPostFn
  .inputValidator(reorderPagesInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<{ reordered: boolean }>> => {
      try {
        const userId = context.user.id
        await verifyDashboardOwnership(data.dashboardId, userId)

        // Validate all page IDs belong to this dashboard
        const existingPages = await db
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.dashboardId, data.dashboardId))

        const existingIds = new Set(existingPages.map((p) => p.id))

        for (const pageId of data.pageIds) {
          if (!existingIds.has(pageId)) {
            throw new ValidationError(
              `Page '${pageId}' does not belong to this dashboard`,
            )
          }
        }

        // Update sort orders
        for (let i = 0; i < data.pageIds.length; i++) {
          await db
            .update(pages)
            .set({ sortOrder: i })
            .where(eq(pages.id, data.pageIds[i]))
        }

        return { success: true, data: { reordered: true } }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

// ─── Rename Page ───────────────────────────────────

const renamePageInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Page name is required').max(100),
  icon: z.string().max(50).optional(),
})

/**
 * Rename a page and optionally change its icon.
 */
export const renamePageFn = protectedPostFn
  .inputValidator(renamePageInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<PageDetail>> => {
    try {
      const userId = context.user.id
      await verifyPageOwnership(data.id, userId)

      const updateValues: Record<string, unknown> = { name: data.name }
      if (data.icon !== undefined) {
        updateValues.icon = data.icon
      }

      const [updated] = await db
        .update(pages)
        .set(updateValues)
        .where(eq(pages.id, data.id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update page')
      }

      const [wCount] = await db
        .select({ count: count() })
        .from(widgets)
        .where(eq(widgets.pageId, updated.id))

      return {
        success: true,
        data: {
          id: updated.id,
          dashboardId: updated.dashboardId,
          name: updated.name,
          icon: updated.icon,
          sortOrder: updated.sortOrder,
          layout: updated.layout,
          widgetCount: wCount.count,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Delete Page ───────────────────────────────────

const deletePageInputSchema = z.object({
  id: z.string().min(1),
})

/**
 * Delete a page and all its widgets (cascade via FK).
 * Prevents deleting the last page in a dashboard.
 */
export const deletePageFn = protectedPostFn
  .inputValidator(deletePageInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<{ deleted: boolean }>> => {
      try {
        const userId = context.user.id
        const { dashboardId } = await verifyPageOwnership(data.id, userId)

        // Prevent deleting the last page
        const [pageCount] = await db
          .select({ count: count() })
          .from(pages)
          .where(eq(pages.dashboardId, dashboardId))

        if (pageCount.count <= 1) {
          throw new ValidationError(
            'Cannot delete the last page in a dashboard',
          )
        }

        // Delete page (widgets cascade via FK)
        await db.delete(pages).where(eq(pages.id, data.id))

        // Re-normalize sort orders
        const remainingPages = await db
          .select({ id: pages.id })
          .from(pages)
          .where(eq(pages.dashboardId, dashboardId))
          .orderBy(asc(pages.sortOrder))

        for (let i = 0; i < remainingPages.length; i++) {
          await db
            .update(pages)
            .set({ sortOrder: i })
            .where(eq(pages.id, remainingPages[i].id))
        }

        return { success: true, data: { deleted: true } }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

// ─── List Pages ────────────────────────────────────

const listPagesInputSchema = z.object({
  dashboardId: z.string().min(1),
})

/**
 * List all pages for a dashboard, ordered by sortOrder.
 */
export const listPagesFn = protectedGetFn
  .inputValidator(listPagesInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<Array<PageDetail>>> => {
      try {
        const userId = context.user.id
        await verifyDashboardOwnership(data.dashboardId, userId)

        const dashboardPages = await db
          .select()
          .from(pages)
          .where(eq(pages.dashboardId, data.dashboardId))
          .orderBy(asc(pages.sortOrder))

        const pagesWithCounts: Array<PageDetail> = await Promise.all(
          dashboardPages.map(async (p) => {
            const [wCount] = await db
              .select({ count: count() })
              .from(widgets)
              .where(eq(widgets.pageId, p.id))

            return {
              id: p.id,
              dashboardId: p.dashboardId,
              name: p.name,
              icon: p.icon,
              sortOrder: p.sortOrder,
              layout: p.layout,
              widgetCount: wCount.count,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
            }
          }),
        )

        return { success: true, data: pagesWithCounts }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )
