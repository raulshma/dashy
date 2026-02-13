/**
 * Backup API Server Functions
 *
 * Server-side functions for exporting dashboards, user data, and database backups.
 */
import { z } from 'zod'
import { backupService } from '@server/services/backup'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ForbiddenError,
  handleServerError,
  NotFoundError,
} from '@server/api/utils'
import type {
  DashboardExport,
  FullBackupMetadata,
  UserDashboardsExport,
} from '@server/services/backup'
import type { ApiResponse } from '@shared/types'

const exportDashboardSchema = z.object({
  dashboardId: z.string().uuid(),
})

const exportUserDashboardsSchema = z.object({
  userId: z.string().uuid().optional(),
})

const importDashboardSchema = z.object({
  exportData: z.record(z.string(), z.unknown()),
  options: z
    .object({
      overwrite: z.boolean().optional(),
      newSlug: z.string().optional(),
    })
    .optional(),
})

export const exportDashboardFn = protectedGetFn
  .inputValidator(exportDashboardSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<DashboardExport>> => {
    try {
      const exportData = await backupService.exportDashboard(data.dashboardId)

      if (exportData.dashboard.id !== context.user.id) {
        throw new ForbiddenError('You do not have access to this dashboard')
      }

      return { success: true, data: exportData }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return handleServerError(
          new NotFoundError('Dashboard', data.dashboardId),
        )
      }
      return handleServerError(error)
    }
  })

export const exportDashboardJsonFn = protectedGetFn
  .inputValidator(exportDashboardSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<string>> => {
    try {
      const exportData = await backupService.exportDashboard(data.dashboardId)

      if (exportData.dashboard.id !== context.user.id) {
        throw new ForbiddenError('You do not have access to this dashboard')
      }

      const json = JSON.stringify(exportData, null, 2)
      return { success: true, data: json }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return handleServerError(
          new NotFoundError('Dashboard', data.dashboardId),
        )
      }
      return handleServerError(error)
    }
  })

export const exportUserDashboardsFn = protectedGetFn
  .inputValidator(exportUserDashboardsSchema)
  .handler(
    async ({ data, context }): Promise<ApiResponse<UserDashboardsExport>> => {
      try {
        const userId = data.userId ?? context.user.id

        if (userId !== context.user.id) {
          throw new ForbiddenError('You can only export your own dashboards')
        }

        const exportData = await backupService.exportUserDashboards(userId)
        return { success: true, data: exportData }
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return handleServerError(new NotFoundError('User', data.userId ?? ''))
        }
        return handleServerError(error)
      }
    },
  )

export const importDashboardFn = protectedPostFn
  .inputValidator(importDashboardSchema)
  .handler(
    async ({
      data,
      context,
    }): Promise<ApiResponse<{ dashboardId: string }>> => {
      try {
        const exportData = data.exportData as unknown as DashboardExport

        const dashboardId = await backupService.importDashboard(
          exportData,
          context.user.id,
          data.options,
        )

        return { success: true, data: { dashboardId } }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

export const listBackupsFn = protectedGetFn.handler(
  (): ApiResponse<Array<FullBackupMetadata & { file: string }>> => {
    try {
      const backups = backupService.listBackups()
      return { success: true, data: backups }
    } catch (error) {
      return handleServerError(error)
    }
  },
)
