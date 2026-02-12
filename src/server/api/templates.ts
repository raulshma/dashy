/**
 * Templates Server Functions
 *
 * CRUD operations for dashboard templates with save/apply functionality.
 */
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import { dashboards, pages, templates, widgets } from '@server/db/schema'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ForbiddenError,
  generateSlug,
  handleServerError,
  NotFoundError,
  ValidationError,
} from '@server/api/utils'
import type { TemplateSchema } from '@server/db/schema/templates'

export interface TemplateSummary {
  id: string
  name: string
  description: string | null
  category: string | null
  thumbnailUrl: string | null
  pageCount: number
  widgetCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TemplateDetail extends TemplateSummary {
  schema: TemplateSchema
}

function countWidgets(schema: TemplateSchema): number {
  return schema.pages.reduce((sum, page) => sum + page.widgets.length, 0)
}

const listTemplatesSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const listTemplatesFn = protectedGetFn
  .inputValidator(listTemplatesSchema)
  .handler(async ({ data }) => {
    try {
      const { category, search, sortBy, sortDir, page, limit } = data
      const offset = (page - 1) * limit

      const conditions = []
      if (category) {
        conditions.push(eq(templates.category, category))
      }
      if (search) {
        conditions.push(
          or(
            ilike(templates.name, `%${search}%`),
            ilike(templates.description, `%${search}%`),
          ),
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const sortColumn =
        sortBy === 'name'
          ? templates.name
          : sortBy === 'createdAt'
            ? templates.createdAt
            : templates.updatedAt
      const orderByClause =
        sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn)

      const rows = await db
        .select()
        .from(templates)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(templates)
        .where(whereClause)

      const total = Number(countResult[0]?.count ?? 0)

      const items: TemplateSummary[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        thumbnailUrl: row.thumbnailUrl,
        pageCount: row.schema.pages.length,
        widgetCount: countWidgets(row.schema),
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))

      return {
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const getTemplateSchema = z.object({
  id: z.string().uuid(),
})

export const getTemplateFn = protectedGetFn
  .inputValidator(getTemplateSchema)
  .handler(async ({ data }) => {
    try {
      const rows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, data.id))
        .limit(1)

      const template = rows[0]
      if (!template) {
        throw new NotFoundError('Template', data.id)
      }

      const result: TemplateDetail = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnailUrl: template.thumbnailUrl,
        pageCount: template.schema.pages.length,
        widgetCount: countWidgets(template.schema),
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        schema: template.schema,
      }

      return { success: true, data: result }
    } catch (error) {
      return handleServerError(error)
    }
  })

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  thumbnailUrl: z.string().url().optional(),
  schema: z.custom<TemplateSchema>((val) => {
    if (typeof val !== 'object' || val === null) return false
    const s = val as TemplateSchema
    return Array.isArray(s.pages)
  }),
})

export const createTemplateFn = protectedPostFn
  .inputValidator(createTemplateSchema)
  .handler(async ({ data, context }) => {
    try {
      const inserted = await db
        .insert(templates)
        .values({
          name: data.name,
          description: data.description ?? null,
          category: data.category ?? null,
          thumbnailUrl: data.thumbnailUrl ?? null,
          schema: data.schema,
          createdBy: context.user.id,
        })
        .returning()

      const template = inserted[0]
      if (!template) {
        throw new Error('Failed to create template')
      }

      const result: TemplateDetail = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnailUrl: template.thumbnailUrl,
        pageCount: template.schema.pages.length,
        widgetCount: countWidgets(template.schema),
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        schema: template.schema,
      }

      return { success: true, data: result }
    } catch (error) {
      return handleServerError(error)
    }
  })

const saveDashboardAsTemplateSchema = z.object({
  dashboardId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
})

export const saveDashboardAsTemplateFn = protectedPostFn
  .inputValidator(saveDashboardAsTemplateSchema)
  .handler(async ({ data, context }) => {
    try {
      const dashboardRows = await db
        .select()
        .from(dashboards)
        .where(eq(dashboards.id, data.dashboardId))
        .limit(1)

      const dashboard = dashboardRows[0]
      if (!dashboard) {
        throw new NotFoundError('Dashboard', data.dashboardId)
      }

      if (dashboard.userId !== context.user.id) {
        throw new ForbiddenError('You do not have access to this dashboard')
      }

      const dashboardPages = await db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, dashboard.id))
        .orderBy(asc(pages.sortOrder))

      const pageIds = dashboardPages.map((p) => p.id)

      let dashboardWidgets: Array<{
        pageId: string
        type: string
        title: string | null
        x: number
        y: number
        w: number
        h: number
        config: Record<string, unknown>
      }> = []

      if (pageIds.length > 0) {
        dashboardWidgets = await db
          .select({
            pageId: widgets.pageId,
            type: widgets.type,
            title: widgets.title,
            x: widgets.x,
            y: widgets.y,
            w: widgets.w,
            h: widgets.h,
            config: widgets.config,
          })
          .from(widgets)
          .where(sql`${widgets.pageId} IN ${pageIds}`)
      }

      const widgetsByPage = new Map<string, typeof dashboardWidgets>()
      for (const widget of dashboardWidgets) {
        const existing = widgetsByPage.get(widget.pageId) ?? []
        existing.push(widget)
        widgetsByPage.set(widget.pageId, existing)
      }

      const templateSchema: TemplateSchema = {
        pages: dashboardPages.map((page) => ({
          name: page.name,
          sortOrder: page.sortOrder,
          layout: page.layout ?? undefined,
          widgets: (widgetsByPage.get(page.id) ?? []).map((w) => ({
            type: w.type,
            title: w.title ?? undefined,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            config: w.config,
          })),
        })),
      }

      const inserted = await db
        .insert(templates)
        .values({
          name: data.name,
          description: data.description ?? null,
          category: data.category ?? null,
          schema: templateSchema,
          createdBy: context.user.id,
        })
        .returning()

      const template = inserted[0]
      if (!template) {
        throw new Error('Failed to create template')
      }

      const result: TemplateDetail = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnailUrl: template.thumbnailUrl,
        pageCount: template.schema.pages.length,
        widgetCount: countWidgets(template.schema),
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        schema: template.schema,
      }

      return { success: true, data: result }
    } catch (error) {
      return handleServerError(error)
    }
  })

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
})

export const applyTemplateFn = protectedPostFn
  .inputValidator(applyTemplateSchema)
  .handler(async ({ data, context }) => {
    try {
      const templateRows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, data.templateId))
        .limit(1)

      const template = templateRows[0]
      if (!template) {
        throw new NotFoundError('Template', data.templateId)
      }

      const dashboardName = data.name ?? `From ${template.name}`
      const dashboardSlug = data.slug ?? generateSlug(dashboardName)

      const dashboardInserted = await db
        .insert(dashboards)
        .values({
          name: dashboardName,
          slug: dashboardSlug,
          userId: context.user.id,
          isPublic: false,
        })
        .returning()

      const newDashboard = dashboardInserted[0]
      if (!newDashboard) {
        throw new Error('Failed to create dashboard')
      }

      for (const pageData of template.schema.pages) {
        const pageInserted = await db
          .insert(pages)
          .values({
            dashboardId: newDashboard.id,
            name: pageData.name,
            sortOrder: pageData.sortOrder,
            layout: pageData.layout ?? null,
          })
          .returning()

        const newPage = pageInserted[0]
        if (!newPage) continue

        for (const widgetData of pageData.widgets) {
          await db.insert(widgets).values({
            pageId: newPage.id,
            type: widgetData.type,
            title: widgetData.title ?? null,
            x: widgetData.x,
            y: widgetData.y,
            w: widgetData.w,
            h: widgetData.h,
            config: widgetData.config,
          })
        }
      }

      const newPages = await db
        .select()
        .from(pages)
        .where(eq(pages.dashboardId, newDashboard.id))
        .orderBy(asc(pages.sortOrder))

      return {
        success: true,
        data: {
          id: newDashboard.id,
          name: newDashboard.name,
          slug: newDashboard.slug,
          pageCount: newPages.length,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const updateTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  thumbnailUrl: z.string().url().optional(),
})

export const updateTemplateFn = protectedPostFn
  .inputValidator(updateTemplateSchema)
  .handler(async ({ data, context }) => {
    try {
      const existing = await db
        .select()
        .from(templates)
        .where(eq(templates.id, data.id))
        .limit(1)

      const template = existing[0]
      if (!template) {
        throw new NotFoundError('Template', data.id)
      }

      if (template.createdBy && template.createdBy !== context.user.id) {
        throw new ForbiddenError(
          'You do not have permission to edit this template',
        )
      }

      const updateValues: Record<string, unknown> = {}
      if (data.name !== undefined) updateValues.name = data.name
      if (data.description !== undefined)
        updateValues.description = data.description
      if (data.category !== undefined) updateValues.category = data.category
      if (data.thumbnailUrl !== undefined)
        updateValues.thumbnailUrl = data.thumbnailUrl

      if (Object.keys(updateValues).length === 0) {
        throw new ValidationError('No changes provided')
      }

      const updated = await db
        .update(templates)
        .set(updateValues)
        .where(eq(templates.id, data.id))
        .returning()

      const result = updated[0]
      if (!result) {
        throw new Error('Failed to update template')
      }

      const detail: TemplateDetail = {
        id: result.id,
        name: result.name,
        description: result.description,
        category: result.category,
        thumbnailUrl: result.thumbnailUrl,
        pageCount: result.schema.pages.length,
        widgetCount: countWidgets(result.schema),
        createdBy: result.createdBy,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        schema: result.schema,
      }

      return { success: true, data: detail }
    } catch (error) {
      return handleServerError(error)
    }
  })

const deleteTemplateSchema = z.object({
  id: z.string().uuid(),
})

export const deleteTemplateFn = protectedPostFn
  .inputValidator(deleteTemplateSchema)
  .handler(async ({ data, context }) => {
    try {
      const existing = await db
        .select()
        .from(templates)
        .where(eq(templates.id, data.id))
        .limit(1)

      const template = existing[0]
      if (!template) {
        throw new NotFoundError('Template', data.id)
      }

      if (template.createdBy && template.createdBy !== context.user.id) {
        throw new ForbiddenError(
          'You do not have permission to delete this template',
        )
      }

      await db.delete(templates).where(eq(templates.id, data.id))

      return { success: true, data: { deleted: true } }
    } catch (error) {
      return handleServerError(error)
    }
  })

const listCategoriesSchema = z.object({})

export const listCategoriesFn = protectedGetFn
  .inputValidator(listCategoriesSchema)
  .handler(async () => {
    try {
      const rows = await db
        .selectDistinct({ category: templates.category })
        .from(templates)
        .where(sql`category IS NOT NULL`)
        .orderBy(asc(templates.category))

      const categories = rows
        .map((r) => r.category)
        .filter((c): c is string => c !== null)

      return { success: true, data: categories }
    } catch (error) {
      return handleServerError(error)
    }
  })
