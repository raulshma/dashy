/**
 * Dashboard YAML Importer
 *
 * Parses YAML, validates against schema, and upserts dashboard/pages/widgets
 * for the authenticated owner in a single transaction.
 */
import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from '@server/db/connection'
import { dashboards, pages, widgets } from '@server/db/schema'
import {
  ForbiddenError,
  generateSlug,
  NotFoundError,
  ValidationError,
} from '@server/api/utils'
import { validateDashboardYaml } from './validator'

export interface ImportDashboardFromYamlOptions {
  /**
   * Explicit dashboard target to update. When omitted, importer tries by slug,
   * otherwise creates a new dashboard.
   */
  dashboardId?: string
}

export interface ImportDashboardFromYamlResult {
  dashboardId: string
  created: boolean
  pagesImported: number
  widgetsImported: number
  warnings: Array<string>
}

async function getDashboardOwnedByUser(dashboardId: string, userId: string) {
  const [dashboard] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId))
    .limit(1)

  if (!dashboard) {
    throw new NotFoundError('Dashboard', dashboardId)
  }

  if (dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this dashboard')
  }

  return dashboard
}

async function ensureUniqueSlug(baseSlug: string, excludeDashboardId?: string) {
  let candidate = baseSlug
  let attempt = 0

  while (attempt < 20) {
    const [existing] = await db
      .select({ id: dashboards.id })
      .from(dashboards)
      .where(eq(dashboards.slug, candidate))
      .limit(1)

    if (
      !existing ||
      (excludeDashboardId && existing.id === excludeDashboardId)
    ) {
      return candidate
    }

    attempt += 1
    const suffix = Math.random().toString(36).slice(2, 7)
    candidate = `${baseSlug}-${suffix}`
  }

  throw new ValidationError('Unable to generate a unique dashboard slug')
}

function createFieldErrorsFromValidationIssues(
  issues: Array<{ source: string; message: string; path?: string }>,
): Record<string, Array<string>> {
  const fieldErrors: Record<string, Array<string>> = {}

  for (const issue of issues) {
    const key = issue.source === 'yaml-schema' ? (issue.path ?? 'root') : 'yaml'

    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }

    fieldErrors[key].push(issue.message)
  }

  return fieldErrors
}

/**
 * Import dashboard YAML into database for a specific owner.
 */
export async function importDashboardFromYaml(
  yamlContent: string,
  userId: string,
  options: ImportDashboardFromYamlOptions = {},
): Promise<ImportDashboardFromYamlResult> {
  const validation = validateDashboardYaml(yamlContent)

  if (!validation.valid || !validation.data) {
    throw new ValidationError(
      'YAML validation failed',
      createFieldErrorsFromValidationIssues(validation.issues),
    )
  }

  const warnings = validation.issues
    .filter((issue) => issue.level === 'warning')
    .map((issue) => issue.message)

  const yamlData = validation.data

  const targetSlug = generateSlug(
    yamlData.dashboard.slug ?? yamlData.dashboard.name,
  )

  if (!targetSlug) {
    throw new ValidationError('Dashboard name or slug is required in YAML')
  }

  let targetDashboard: typeof dashboards.$inferSelect | undefined

  if (options.dashboardId) {
    targetDashboard = await getDashboardOwnedByUser(options.dashboardId, userId)
  } else {
    const [bySlug] = await db
      .select()
      .from(dashboards)
      .where(
        and(
          eq(dashboards.userId, userId),
          eq(dashboards.slug, targetSlug),
          isNull(dashboards.deletedAt),
        ),
      )
      .limit(1)

    targetDashboard = bySlug
  }

  const finalSlug = await ensureUniqueSlug(targetSlug, targetDashboard?.id)

  return await db.transaction(async (tx) => {
    let created = false
    let dashboardId = targetDashboard?.id

    if (targetDashboard) {
      await tx
        .update(dashboards)
        .set({
          name: yamlData.dashboard.name,
          slug: finalSlug,
          description: yamlData.dashboard.description ?? null,
          isPublic: yamlData.dashboard.isPublic,
          icon: yamlData.dashboard.icon ?? null,
          deletedAt: null,
        })
        .where(eq(dashboards.id, targetDashboard.id))
    } else {
      const [existingCount] = await tx
        .select({ count: count() })
        .from(dashboards)
        .where(and(eq(dashboards.userId, userId), isNull(dashboards.deletedAt)))

      const [insertedDashboard] = await tx
        .insert(dashboards)
        .values({
          userId,
          name: yamlData.dashboard.name,
          slug: finalSlug,
          description: yamlData.dashboard.description ?? null,
          isPublic: yamlData.dashboard.isPublic,
          icon: yamlData.dashboard.icon ?? null,
          isDefault: (existingCount?.count ?? 0) === 0,
        })
        .returning()

      if (!insertedDashboard) {
        throw new Error('Failed to create dashboard from YAML')
      }

      dashboardId = insertedDashboard.id
      created = true
    }

    if (!dashboardId) {
      throw new Error('Dashboard ID unavailable during YAML import')
    }

    await tx.delete(pages).where(eq(pages.dashboardId, dashboardId))

    let widgetsImported = 0

    for (const [index, page] of yamlData.pages.entries()) {
      const [newPage] = await tx
        .insert(pages)
        .values({
          dashboardId,
          name: page.name,
          icon: page.icon ?? null,
          sortOrder: Number.isFinite(page.sortOrder) ? page.sortOrder : index,
          layout: page.layout ?? null,
        })
        .returning()

      if (!newPage) {
        throw new Error(`Failed to create page '${page.name}' from YAML`)
      }

      if (page.widgets.length === 0) {
        continue
      }

      const widgetRows = page.widgets.map((widget) => ({
        pageId: newPage.id,
        type: widget.type,
        title: widget.title ?? null,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        config: widget.config,
      }))

      await tx.insert(widgets).values(widgetRows)
      widgetsImported += widgetRows.length
    }

    return {
      dashboardId,
      created,
      pagesImported: yamlData.pages.length,
      widgetsImported,
      warnings,
    }
  })
}
