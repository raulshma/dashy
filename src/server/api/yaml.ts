/**
 * YAML Server Functions
 *
 * Exposes dashboard YAML export/validate/import operations behind authenticated
 * server functions.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { dashboards } from '@server/db/schema'
import { db } from '@server/db/connection'
import {
  exportDashboardToYaml,
  importDashboardFromYaml,
  validateDashboardYaml,
} from '@server/yaml'
import { protectedGetFn, protectedPostFn } from './auth'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  handleServerError,
} from './utils'
import type { ApiResponse } from '@shared/types'

const YAML_MAX_SIZE_BYTES = 500_000

interface OwnedDashboard {
  id: string
  slug: string
  name: string
  updatedAt: string
  userId: string
}

async function resolveOwnedDashboardByIdentifier(
  identifier: string,
  userId: string,
): Promise<OwnedDashboard> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      identifier,
    )

  const [dashboard] = await db
    .select({
      id: dashboards.id,
      slug: dashboards.slug,
      name: dashboards.name,
      updatedAt: dashboards.updatedAt,
      userId: dashboards.userId,
    })
    .from(dashboards)
    .where(
      and(
        isUuid ? eq(dashboards.id, identifier) : eq(dashboards.slug, identifier),
        isNull(dashboards.deletedAt),
      ),
    )
    .limit(1)

  if (!dashboard) {
    throw new NotFoundError('Dashboard', identifier)
  }

  if (dashboard.userId !== userId) {
    throw new ForbiddenError('You do not have access to this dashboard')
  }

  return dashboard
}

async function resolveOwnedDashboardById(
  dashboardId: string,
  userId: string,
): Promise<OwnedDashboard> {
  const [dashboard] = await db
    .select({
      id: dashboards.id,
      slug: dashboards.slug,
      name: dashboards.name,
      updatedAt: dashboards.updatedAt,
      userId: dashboards.userId,
    })
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

const exportYamlInputSchema = z.object({
  identifier: z.string().min(1),
})

export interface DashboardYamlExportPayload {
  dashboardId: string
  slug: string
  name: string
  updatedAt: string
  yaml: string
}

/**
 * Export a dashboard owned by the current user as validated YAML.
 */
export const exportDashboardYamlFn = protectedGetFn
  .inputValidator(exportYamlInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<DashboardYamlExportPayload>> => {
      try {
        const dashboard = await resolveOwnedDashboardByIdentifier(
          data.identifier,
          context.user.id,
        )

        const exported = await exportDashboardToYaml(dashboard.id)

        return {
          success: true,
          data: {
            dashboardId: dashboard.id,
            slug: dashboard.slug,
            name: dashboard.name,
            updatedAt: dashboard.updatedAt,
            yaml: exported.yaml,
          },
        }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

const validateYamlInputSchema = z.object({
  yamlContent: z
    .string()
    .trim()
    .min(1, 'YAML cannot be empty')
    .max(
      YAML_MAX_SIZE_BYTES,
      `YAML exceeds max size (${Math.round(YAML_MAX_SIZE_BYTES / 1000)}KB)`,
    ),
})

export interface DashboardYamlValidationPayload {
  valid: boolean
  issues: ReturnType<typeof validateDashboardYaml>['issues']
  preview?: ReturnType<typeof validateDashboardYaml>['data']
}

/**
 * Validate dashboard YAML client-side edits and return structured diagnostics.
 */
export const validateDashboardYamlFn = protectedPostFn
  .inputValidator(validateYamlInputSchema)
  .handler(
    async ({ data }): Promise<ApiResponse<DashboardYamlValidationPayload>> => {
      try {
        const result = validateDashboardYaml(data.yamlContent)

        return {
          success: true,
          data: {
            valid: result.valid,
            issues: result.issues,
            preview: result.data,
          },
        }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

const applyYamlInputSchema = z.object({
  dashboardId: z.string().min(1),
  yamlContent: z
    .string()
    .trim()
    .min(1, 'YAML cannot be empty')
    .max(
      YAML_MAX_SIZE_BYTES,
      `YAML exceeds max size (${Math.round(YAML_MAX_SIZE_BYTES / 1000)}KB)`,
    ),
  expectedUpdatedAt: z.string().optional(),
  force: z.boolean().default(false),
})

export interface ApplyDashboardYamlPayload {
  dashboardId: string
  slug: string
  name: string
  updatedAt: string
  yaml: string
  created: boolean
  pagesImported: number
  widgetsImported: number
  warnings: string[]
}

/**
 * Apply YAML to a dashboard with optimistic conflict checks against updatedAt.
 */
export const applyDashboardYamlFn = protectedPostFn
  .inputValidator(applyYamlInputSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<ApplyDashboardYamlPayload>> => {
      try {
        const ownedDashboard = await resolveOwnedDashboardById(
          data.dashboardId,
          context.user.id,
        )

        if (
          data.expectedUpdatedAt &&
          !data.force &&
          ownedDashboard.updatedAt !== data.expectedUpdatedAt
        ) {
          throw new ConflictError(
            'Dashboard was updated after YAML load. Refresh or force apply to overwrite newer visual edits.',
          )
        }

        const imported = await importDashboardFromYaml(
          data.yamlContent,
          context.user.id,
          {
            dashboardId: data.dashboardId,
          },
        )

        const refreshedDashboard = await resolveOwnedDashboardById(
          imported.dashboardId,
          context.user.id,
        )

        const exported = await exportDashboardToYaml(refreshedDashboard.id)

        return {
          success: true,
          data: {
            dashboardId: refreshedDashboard.id,
            slug: refreshedDashboard.slug,
            name: refreshedDashboard.name,
            updatedAt: refreshedDashboard.updatedAt,
            yaml: exported.yaml,
            created: imported.created,
            pagesImported: imported.pagesImported,
            widgetsImported: imported.widgetsImported,
            warnings: imported.warnings,
          },
        }
      } catch (error) {
        if (
          error instanceof ValidationError &&
          (error.message.includes('YAML') || error.message.includes('yaml'))
        ) {
          return handleServerError(error)
        }

        return handleServerError(error)
      }
    },
  )