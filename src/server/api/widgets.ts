/**
 * Widget Server Functions
 *
 * CRUD operations for widgets within pages.
 * Supports creating, updating config, updating positions, and deleting widgets.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import { dashboards, pages, widgets } from '@server/db/schema'
import { protectedPostFn } from '@server/api/auth'
import { publishDashboardEvent } from '@server/realtime/ws'
import {
  ForbiddenError,
  handleServerError,
  NotFoundError,
  ValidationError,
} from '@server/api/utils'

// ─── Helpers ───────────────────────────────────────

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

  const [dashboard] = await db
    .select({ userId: dashboards.userId })
    .from(dashboards)
    .where(eq(dashboards.id, page.dashboardId))
    .limit(1)

  if (!dashboard || dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this page')
  }

  return {
    pageId: page.id,
    dashboardId: page.dashboardId,
  }
}

async function verifyWidgetOwnership(
  widgetId: string,
  userId: string,
): Promise<{
  widgetId: string
  pageId: string
  dashboardId: string
  updatedAt: string
}> {
  const [widget] = await db
    .select()
    .from(widgets)
    .where(eq(widgets.id, widgetId))
    .limit(1)

  if (!widget) {
    throw new NotFoundError('Widget', widgetId)
  }

  const [page] = await db
    .select({ dashboardId: pages.dashboardId })
    .from(pages)
    .where(eq(pages.id, widget.pageId))
    .limit(1)

  if (!page) {
    throw new NotFoundError('Page', widget.pageId)
  }

  const [dashboard] = await db
    .select({ userId: dashboards.userId })
    .from(dashboards)
    .where(eq(dashboards.id, page.dashboardId))
    .limit(1)

  if (!dashboard || dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this widget')
  }

  return {
    widgetId: widget.id,
    pageId: widget.pageId,
    dashboardId: page.dashboardId,
    updatedAt: widget.updatedAt,
  }
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return 0
  }

  return timestamp
}

async function getOwnedWidget(widgetId: string, userId: string) {
  const [widget] = await db
    .select()
    .from(widgets)
    .where(eq(widgets.id, widgetId))
    .limit(1)

  if (!widget) {
    throw new NotFoundError('Widget', widgetId)
  }

  const [page] = await db
    .select({ dashboardId: pages.dashboardId })
    .from(pages)
    .where(eq(pages.id, widget.pageId))
    .limit(1)

  if (!page) {
    throw new NotFoundError('Page', widget.pageId)
  }

  const [dashboard] = await db
    .select({ userId: dashboards.userId })
    .from(dashboards)
    .where(eq(dashboards.id, page.dashboardId))
    .limit(1)

  if (!dashboard || dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this widget')
  }

  return widget
}

// ─── Add Widget ────────────────────────────────────

const addWidgetInputSchema = z.object({
  pageId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().max(100).optional(),
  x: z.number().int().min(0).default(0),
  y: z.number().int().min(0).default(0),
  w: z.number().int().min(1).max(12).default(1),
  h: z.number().int().min(1).max(12).default(1),
  config: z.record(z.string(), z.any()).optional(),
  realtimeClientId: z.string().min(1).max(80).optional(),
})

export const addWidgetFn = protectedPostFn
  .inputValidator(addWidgetInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      const pageContext = await verifyPageOwnership(data.pageId, userId)

      const [newWidget] = await db
        .insert(widgets)
        .values({
          pageId: data.pageId,
          type: data.type,
          title: data.title ?? null,
          x: data.x,
          y: data.y,
          w: data.w,
          h: data.h,
          config: data.config ?? {},
        })
        .returning()

      if (!newWidget) {
        throw new Error('Failed to create widget')
      }

      publishDashboardEvent({
        dashboardId: pageContext.dashboardId,
        actorId: data.realtimeClientId ?? userId,
        event: 'widget:update',
        payload: {
          action: 'created',
          pageId: newWidget.pageId,
          widget: {
            id: newWidget.id,
            type: newWidget.type,
            title: newWidget.title,
            x: newWidget.x,
            y: newWidget.y,
            w: newWidget.w,
            h: newWidget.h,
            config: newWidget.config,
          },
        },
        excludeClientId: data.realtimeClientId,
      })

      return {
        success: true,
        data: {
          id: newWidget.id,
          pageId: newWidget.pageId,
          type: newWidget.type,
          title: newWidget.title,
          x: newWidget.x,
          y: newWidget.y,
          w: newWidget.w,
          h: newWidget.h,
          config: newWidget.config,
          createdAt: newWidget.createdAt,
          updatedAt: newWidget.updatedAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Update Widget Config ──────────────────────────

const updateWidgetConfigInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  realtimeClientId: z.string().min(1).max(80).optional(),
  mutationTimestamp: z.number().int().positive().optional(),
})

export const updateWidgetConfigFn = protectedPostFn
  .inputValidator(updateWidgetConfigInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      const widgetContext = await verifyWidgetOwnership(data.id, userId)

      if (
        data.mutationTimestamp !== undefined &&
        toTimestamp(widgetContext.updatedAt) > data.mutationTimestamp
      ) {
        throw new ValidationError(
          'Stale widget update rejected by last-write-wins policy',
        )
      }

      const updateValues: Record<string, unknown> = {}
      if (data.title !== undefined) {
        updateValues.title = data.title
      }
      if (data.config !== undefined) {
        updateValues.config = data.config
      }

      const [updated] = await db
        .update(widgets)
        .set(updateValues)
        .where(eq(widgets.id, data.id))
        .returning()

      if (!updated) {
        throw new Error('Failed to update widget')
      }

      publishDashboardEvent({
        dashboardId: widgetContext.dashboardId,
        actorId: data.realtimeClientId ?? userId,
        event: 'widget:update',
        payload: {
          action: 'updated',
          pageId: updated.pageId,
          widgetId: updated.id,
          patch: {
            ...(data.title !== undefined ? { title: updated.title } : {}),
            ...(data.config !== undefined ? { config: updated.config } : {}),
          },
        },
        excludeClientId: data.realtimeClientId,
      })

      return {
        success: true,
        data: {
          id: updated.id,
          pageId: updated.pageId,
          type: updated.type,
          title: updated.title,
          x: updated.x,
          y: updated.y,
          w: updated.w,
          h: updated.h,
          config: updated.config,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Update Widget Positions (Batch) ───────────────

const updateWidgetPositionsInputSchema = z.object({
  positions: z
    .array(
      z.object({
        id: z.string().uuid(),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().min(1).max(12),
        h: z.number().int().min(1).max(12),
      }),
    )
    .min(1),
  realtimeClientId: z.string().min(1).max(80).optional(),
  mutationTimestamp: z.number().int().positive().optional(),
})

export const updateWidgetPositionsFn = protectedPostFn
  .inputValidator(updateWidgetPositionsInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      let dashboardId: string | null = null
      let pageId: string | null = null

      let updatedCount = 0
      for (const pos of data.positions) {
        const widgetContext = await verifyWidgetOwnership(pos.id, userId)

        if (
          data.mutationTimestamp !== undefined &&
          toTimestamp(widgetContext.updatedAt) > data.mutationTimestamp
        ) {
          throw new ValidationError(
            'Stale layout update rejected by last-write-wins policy',
          )
        }

        if (!dashboardId) {
          dashboardId = widgetContext.dashboardId
        } else if (dashboardId !== widgetContext.dashboardId) {
          throw new ValidationError(
            'All position updates must belong to the same dashboard',
          )
        }

        if (!pageId) {
          pageId = widgetContext.pageId
        } else if (pageId !== widgetContext.pageId) {
          throw new ValidationError(
            'All position updates must belong to the same page',
          )
        }

        const [result] = await db
          .update(widgets)
          .set({
            x: pos.x,
            y: pos.y,
            w: pos.w,
            h: pos.h,
          })
          .where(eq(widgets.id, pos.id))
          .returning()

        if (result) {
          updatedCount++
        }
      }

      if (dashboardId && pageId && updatedCount > 0) {
        publishDashboardEvent({
          dashboardId,
          actorId: data.realtimeClientId ?? userId,
          event: 'layout:change',
          payload: {
            pageId,
            positions: data.positions.map((position) => ({
              id: position.id,
              x: position.x,
              y: position.y,
              w: position.w,
              h: position.h,
            })),
          },
          excludeClientId: data.realtimeClientId,
        })
      }

      return { success: true, data: { updated: updatedCount } }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Delete Widget ─────────────────────────────────

const deleteWidgetInputSchema = z.object({
  id: z.string().uuid(),
  realtimeClientId: z.string().min(1).max(80).optional(),
})

export const deleteWidgetFn = protectedPostFn
  .inputValidator(deleteWidgetInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      const widgetContext = await verifyWidgetOwnership(data.id, userId)

      await db.delete(widgets).where(eq(widgets.id, data.id))

      publishDashboardEvent({
        dashboardId: widgetContext.dashboardId,
        actorId: data.realtimeClientId ?? userId,
        event: 'widget:update',
        payload: {
          action: 'deleted',
          pageId: widgetContext.pageId,
          widgetId: data.id,
        },
        excludeClientId: data.realtimeClientId,
      })

      return { success: true, data: { deleted: true } }
    } catch (error) {
      return handleServerError(error)
    }
  })

// ─── Duplicate Widget ──────────────────────────────

const duplicateWidgetInputSchema = z.object({
  id: z.string().uuid(),
  offsetX: z.number().int().min(-12).max(12).default(1),
  offsetY: z.number().int().min(-12).max(12).default(1),
  realtimeClientId: z.string().min(1).max(80).optional(),
})

export const duplicateWidgetFn = protectedPostFn
  .inputValidator(duplicateWidgetInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      const sourceWidget = await getOwnedWidget(data.id, userId)

      const maxX = Math.max(0, 12 - sourceWidget.w)
      const nextX = Math.min(maxX, Math.max(0, sourceWidget.x + data.offsetX))
      const nextY = Math.max(0, sourceWidget.y + data.offsetY)

      const duplicatedTitle = sourceWidget.title
        ? `${sourceWidget.title} (Copy)`.slice(0, 100)
        : null

      const [duplicatedWidget] = await db
        .insert(widgets)
        .values({
          pageId: sourceWidget.pageId,
          type: sourceWidget.type,
          title: duplicatedTitle,
          x: nextX,
          y: nextY,
          w: sourceWidget.w,
          h: sourceWidget.h,
          config: structuredClone(sourceWidget.config ?? {}),
        })
        .returning()

      if (!duplicatedWidget) {
        throw new Error('Failed to duplicate widget')
      }

      const [sourcePage] = await db
        .select({ dashboardId: pages.dashboardId })
        .from(pages)
        .where(eq(pages.id, duplicatedWidget.pageId))
        .limit(1)

      if (sourcePage) {
        publishDashboardEvent({
          dashboardId: sourcePage.dashboardId,
          actorId: data.realtimeClientId ?? userId,
          event: 'widget:update',
          payload: {
            action: 'created',
            pageId: duplicatedWidget.pageId,
            widget: {
              id: duplicatedWidget.id,
              type: duplicatedWidget.type,
              title: duplicatedWidget.title,
              x: duplicatedWidget.x,
              y: duplicatedWidget.y,
              w: duplicatedWidget.w,
              h: duplicatedWidget.h,
              config: duplicatedWidget.config,
            },
          },
          excludeClientId: data.realtimeClientId,
        })
      }

      return {
        success: true,
        data: {
          id: duplicatedWidget.id,
          pageId: duplicatedWidget.pageId,
          type: duplicatedWidget.type,
          title: duplicatedWidget.title,
          x: duplicatedWidget.x,
          y: duplicatedWidget.y,
          w: duplicatedWidget.w,
          h: duplicatedWidget.h,
          config: duplicatedWidget.config,
          createdAt: duplicatedWidget.createdAt,
          updatedAt: duplicatedWidget.updatedAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
