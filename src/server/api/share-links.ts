/**
 * Share Links Server Functions
 *
 * CRUD operations for shareable dashboard links with read-only and embed modes.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import { dashboards, pages, shareLinks, widgets } from '@server/db/schema'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ForbiddenError,
  handleServerError,
  NotFoundError,
  publicGetFn,
  ValidationError,
} from '@server/api/utils'

export interface ShareLinkDetail {
  id: string
  dashboardId: string
  dashboardName: string
  token: string
  mode: 'read-only' | 'embed'
  label: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export interface PublicDashboardDetail {
  id: string
  name: string
  description: string | null
  slug: string
  pages: Array<{
    id: string
    name: string
    icon: string | null
    sortOrder: number
    widgets: Array<{
      id: string
      type: string
      title: string | null
      config: Record<string, unknown>
      x: number
      y: number
      w: number
      h: number
    }>
  }>
}

async function verifyDashboardOwnership(
  dashboardId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ userId: dashboards.userId })
    .from(dashboards)
    .where(and(eq(dashboards.id, dashboardId), isNull(dashboards.deletedAt)))

  const dashboard = rows.at(0)
  if (!dashboard) {
    throw new NotFoundError('Dashboard', dashboardId)
  }

  if (dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this dashboard')
  }
}

const createShareLinkSchema = z.object({
  dashboardId: z.string().uuid(),
  mode: z.enum(['read-only', 'embed']).default('read-only'),
  label: z.string().max(100).optional(),
  expiresAt: z.string().datetime().optional(),
})

export const createShareLinkFn = protectedPostFn
  .inputValidator(createShareLinkSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      await verifyDashboardOwnership(data.dashboardId, userId)

      const dashboardRows = await db
        .select({ name: dashboards.name })
        .from(dashboards)
        .where(eq(dashboards.id, data.dashboardId))
        .limit(1)

      const dashboardName = dashboardRows[0]?.name ?? ''

      const insertedLinks = await db
        .insert(shareLinks)
        .values({
          dashboardId: data.dashboardId,
          mode: data.mode,
          label: data.label ?? null,
          expiresAt: data.expiresAt ?? null,
          isActive: 'true',
        })
        .returning()

      const shareLink = insertedLinks.at(0)
      if (!shareLink) {
        throw new Error('Failed to create share link')
      }

      return {
        success: true,
        data: {
          id: shareLink.id,
          dashboardId: shareLink.dashboardId,
          dashboardName,
          token: shareLink.token,
          mode: shareLink.mode,
          label: shareLink.label,
          expiresAt: shareLink.expiresAt,
          isActive: shareLink.isActive === 'true',
          createdAt: shareLink.createdAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const listShareLinksSchema = z.object({
  dashboardId: z.string().uuid(),
})

export const listShareLinksFn = protectedGetFn
  .inputValidator(listShareLinksSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id
      await verifyDashboardOwnership(data.dashboardId, userId)

      const dashboardRows = await db
        .select({ name: dashboards.name })
        .from(dashboards)
        .where(eq(dashboards.id, data.dashboardId))
        .limit(1)

      const dashboardName = dashboardRows[0]?.name ?? ''

      const links = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.dashboardId, data.dashboardId))
        .orderBy(asc(shareLinks.createdAt))

      return {
        success: true,
        data: links.map((link) => ({
          id: link.id,
          dashboardId: link.dashboardId,
          dashboardName,
          token: link.token,
          mode: link.mode,
          label: link.label,
          expiresAt: link.expiresAt,
          isActive: link.isActive === 'true',
          createdAt: link.createdAt,
        })),
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const updateShareLinkSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(100).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateShareLinkFn = protectedPostFn
  .inputValidator(updateShareLinkSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id

      const existingLinks = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.id, data.id))
        .limit(1)

      const existingLink = existingLinks[0]
      if (!existingLink) {
        throw new NotFoundError('Share link', data.id)
      }

      await verifyDashboardOwnership(existingLink.dashboardId, userId)

      const updateValues: Record<string, unknown> = {}

      if (data.label !== undefined) {
        updateValues.label = data.label
      }

      if (data.expiresAt !== undefined) {
        updateValues.expiresAt = data.expiresAt
      }

      if (data.isActive !== undefined) {
        updateValues.isActive = data.isActive ? 'true' : 'false'
      }

      if (Object.keys(updateValues).length === 0) {
        throw new ValidationError('No changes provided')
      }

      const updatedLinks = await db
        .update(shareLinks)
        .set(updateValues)
        .where(eq(shareLinks.id, data.id))
        .returning()

      const updated = updatedLinks[0]
      if (!updated) {
        throw new Error('Failed to update share link')
      }

      const dashboardRows = await db
        .select({ name: dashboards.name })
        .from(dashboards)
        .where(eq(dashboards.id, updated.dashboardId))
        .limit(1)

      const dashboardName = dashboardRows[0]?.name ?? ''

      return {
        success: true,
        data: {
          id: updated.id,
          dashboardId: updated.dashboardId,
          dashboardName,
          token: updated.token,
          mode: updated.mode,
          label: updated.label,
          expiresAt: updated.expiresAt,
          isActive: updated.isActive === 'true',
          createdAt: updated.createdAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const deleteShareLinkSchema = z.object({
  id: z.string().uuid(),
})

export const deleteShareLinkFn = protectedPostFn
  .inputValidator(deleteShareLinkSchema)
  .handler(async ({ data, context }) => {
    try {
      const userId = context.user.id

      const existingLinks = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.id, data.id))
        .limit(1)

      const existingLink = existingLinks[0]
      if (!existingLink) {
        throw new NotFoundError('Share link', data.id)
      }

      await verifyDashboardOwnership(existingLink.dashboardId, userId)

      await db.delete(shareLinks).where(eq(shareLinks.id, data.id))

      return { success: true, data: { deleted: true } }
    } catch (error) {
      return handleServerError(error)
    }
  })

const getPublicDashboardSchema = z.object({
  token: z.string().min(1),
})

export const getPublicDashboardFn = publicGetFn
  .inputValidator(getPublicDashboardSchema)
  .handler(async ({ data }) => {
    try {
      const shareLinkRows = await db
        .select()
        .from(shareLinks)
        .where(eq(shareLinks.token, data.token))
        .limit(1)

      const shareLink = shareLinkRows[0]
      if (!shareLink) {
        throw new NotFoundError('Share link', data.token)
      }

      if (shareLink.isActive !== 'true') {
        throw new ValidationError('This share link has been deactivated')
      }

      if (shareLink.expiresAt) {
        const expiresAtDate = new Date(shareLink.expiresAt)
        if (expiresAtDate < new Date()) {
          throw new ValidationError('This share link has expired')
        }
      }

      const dashboardRows = await db
        .select()
        .from(dashboards)
        .where(
          and(
            eq(dashboards.id, shareLink.dashboardId),
            isNull(dashboards.deletedAt),
          ),
        )
        .limit(1)

      const dashboard = dashboardRows[0]
      if (!dashboard) {
        throw new NotFoundError('Dashboard', shareLink.dashboardId)
      }

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
          config: Record<string, unknown>
          x: number
          y: number
          w: number
          h: number
        }>
      >()

      if (pageIds.length > 0) {
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

      const pagesWithWidgets = dashboardPages.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        sortOrder: p.sortOrder,
        widgets: widgetsByPage.get(p.id) ?? [],
      }))

      return {
        success: true,
        data: {
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          slug: dashboard.slug,
          pages: pagesWithWidgets,
          mode: shareLink.mode,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
