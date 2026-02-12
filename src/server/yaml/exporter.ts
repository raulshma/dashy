/**
 * Dashboard YAML Exporter
 *
 * Queries dashboard structure from DB and serializes it to a validated YAML
 * document using the shared dashboard YAML schema.
 */
import { asc, eq } from 'drizzle-orm'
import { stringify } from 'yaml'
import { db } from '@server/db/connection'
import { dashboards, pages, widgets } from '@server/db/schema'
import { dashboardYamlSchema } from '@shared/schemas'
import type { DashboardYaml, YamlPage, YamlWidget } from '@shared/schemas'

export interface ExportDashboardToYamlResult {
  document: DashboardYaml
  yaml: string
}

function toYamlWidget(widget: typeof widgets.$inferSelect): YamlWidget {
  return {
    type: widget.type,
    title: widget.title ?? undefined,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    config: widget.config,
  }
}

function toYamlPage(
  page: typeof pages.$inferSelect,
  pageWidgets: Array<typeof widgets.$inferSelect>,
): YamlPage {
  return {
    name: page.name,
    sortOrder: page.sortOrder,
    icon: page.icon ?? undefined,
    layout: page.layout
      ? {
          columns: page.layout.columns ?? 12,
          rowHeight: page.layout.rowHeight ?? 80,
          gap: page.layout.gap ?? 16,
        }
      : undefined,
    widgets: pageWidgets.map(toYamlWidget),
  }
}

export async function exportDashboardToYaml(
  dashboardId: string,
): Promise<ExportDashboardToYamlResult> {
  const dashboardRows = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId))
    .limit(1)

  const dashboard = dashboardRows[0] as
    | (typeof dashboards.$inferSelect)
    | undefined

  if (!dashboard) {
    throw new Error(`Dashboard not found: ${dashboardId}`)
  }

  const dashboardPages = await db
    .select()
    .from(pages)
    .where(eq(pages.dashboardId, dashboardId))
    .orderBy(asc(pages.sortOrder), asc(pages.createdAt))

  const pageModels = await Promise.all(
    dashboardPages.map(async (page) => {
      const pageWidgets = await db
        .select()
        .from(widgets)
        .where(eq(widgets.pageId, page.id))
        .orderBy(asc(widgets.y), asc(widgets.x), asc(widgets.createdAt))

      return toYamlPage(page, pageWidgets)
    }),
  )

  const validatedDocument = dashboardYamlSchema.parse({
    version: 1,
    dashboard: {
      name: dashboard.name,
      slug: dashboard.slug,
      description: dashboard.description ?? undefined,
      isPublic: dashboard.isPublic,
      icon: dashboard.icon ?? undefined,
    },
    pages: pageModels,
  })

  const yamlBody = stringify(validatedDocument, {
    lineWidth: 100,
    defaultStringType: 'QUOTE_SINGLE',
    simpleKeys: true,
  })

  const yaml = [
    '# Dashy dashboard export',
    `# dashboardId: ${dashboard.id}`,
    `# generatedAt: ${new Date().toISOString()}`,
    '',
    yamlBody,
  ].join('\n')

  return {
    document: validatedDocument,
    yaml,
  }
}
