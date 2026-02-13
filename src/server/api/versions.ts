/**
 * Dashboard Version Server Functions
 *
 * Version history management: create snapshots, list versions, restore.
 */
import { count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@server/db/connection'
import {
  dashboards,
  dashboardVersions,
  pages,
  widgets,
} from '@server/db/schema'
import { protectedGetFn, protectedPostFn } from '@server/api/auth'
import {
  ForbiddenError,
  handleServerError,
  NotFoundError,
} from '@server/api/utils'
import { createPaginatedResponse } from '@shared/types'
import type { ApiResponse, PaginatedResponse } from '@shared/types'
import type { DashboardSnapshot } from '@server/db/schema'

export interface VersionSummary {
  id: string
  version: number
  changeDescription: string | null
  createdAt: string
}

export interface VersionDetail extends VersionSummary {
  snapshot: DashboardSnapshot
}

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

async function getNextVersionNumber(dashboardId: string): Promise<number> {
  const [latest] = await db
    .select({ version: dashboardVersions.version })
    .from(dashboardVersions)
    .where(eq(dashboardVersions.dashboardId, dashboardId))
    .orderBy(desc(dashboardVersions.version))
    .limit(1)

  return (latest?.version ?? 0) + 1
}

async function createSnapshot(dashboardId: string): Promise<DashboardSnapshot> {
  const [dashboard] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.id, dashboardId))
    .limit(1)

  if (!dashboard) {
    throw new NotFoundError('Dashboard', dashboardId)
  }

  const dashboardPages = await db
    .select()
    .from(pages)
    .where(eq(pages.dashboardId, dashboardId))

  const pagesWithWidgets = await Promise.all(
    dashboardPages.map(async (p) => {
      const pageWidgets = await db
        .select()
        .from(widgets)
        .where(eq(widgets.pageId, p.id))

      return {
        name: p.name,
        sortOrder: p.sortOrder,
        layout: p.layout ?? undefined,
        widgets: pageWidgets.map((w) => ({
          type: w.type,
          title: w.title ?? undefined,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          config: w.config ?? {},
        })),
      }
    }),
  )

  return {
    name: dashboard.name,
    description: dashboard.description ?? undefined,
    pages: pagesWithWidgets,
  }
}

const createVersionInputSchema = z.object({
  dashboardId: z.string().min(1),
  changeDescription: z.string().max(500).optional(),
})

export const createVersionFn = protectedPostFn
  .inputValidator(createVersionInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<VersionSummary>> => {
    try {
      const userId = context.user.id
      await verifyDashboardOwnership(data.dashboardId, userId)

      const version = await getNextVersionNumber(data.dashboardId)
      const snapshot = await createSnapshot(data.dashboardId)

      const [newVersion] = await db
        .insert(dashboardVersions)
        .values({
          dashboardId: data.dashboardId,
          version,
          snapshot,
          changeDescription: data.changeDescription ?? null,
        })
        .returning()

      if (!newVersion) {
        throw new Error('Failed to create version')
      }

      return {
        success: true,
        data: {
          id: newVersion.id,
          version: newVersion.version,
          changeDescription: newVersion.changeDescription,
          createdAt: newVersion.createdAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const listVersionsInputSchema = z.object({
  dashboardId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const listVersionsFn = protectedGetFn
  .inputValidator(listVersionsInputSchema)
  .handler(
    async ({
      data,
      context,
    }): Promise<ApiResponse<PaginatedResponse<VersionSummary>>> => {
      try {
        const userId = context.user.id
        await verifyDashboardOwnership(data.dashboardId, userId)

        const { page, limit } = data
        const offset = (page - 1) * limit

        const [totalResult] = await db
          .select({ count: count() })
          .from(dashboardVersions)
          .where(eq(dashboardVersions.dashboardId, data.dashboardId))

        const total = totalResult?.count ?? 0

        const versions = await db
          .select({
            id: dashboardVersions.id,
            version: dashboardVersions.version,
            changeDescription: dashboardVersions.changeDescription,
            createdAt: dashboardVersions.createdAt,
          })
          .from(dashboardVersions)
          .where(eq(dashboardVersions.dashboardId, data.dashboardId))
          .orderBy(desc(dashboardVersions.version))
          .limit(limit)
          .offset(offset)

        return {
          success: true,
          data: createPaginatedResponse(versions, total, { page, limit }),
        }
      } catch (error) {
        return handleServerError(error)
      }
    },
  )

const getVersionInputSchema = z.object({
  versionId: z.string().min(1),
})

async function getVersionHandler({
  data,
  context,
}: {
  data: z.infer<typeof getVersionInputSchema>
  context: { user: { id: string } }
}) {
  const userId = context.user.id

  const [version] = await db
    .select()
    .from(dashboardVersions)
    .where(eq(dashboardVersions.id, data.versionId))
    .limit(1)

  if (!version) {
    throw new NotFoundError('Version', data.versionId)
  }

  await verifyDashboardOwnership(version.dashboardId, userId)

  return {
    success: true,
    data: {
      id: version.id,
      version: version.version,
      changeDescription: version.changeDescription,
      createdAt: version.createdAt,
      snapshot: version.snapshot,
    },
  }
}

export const getVersionFn = protectedGetFn
  .inputValidator(getVersionInputSchema)

  .handler(getVersionHandler as any)

const restoreVersionInputSchema = z.object({
  versionId: z.string().min(1),
})

export const restoreVersionFn = protectedPostFn
  .inputValidator(restoreVersionInputSchema)
  .handler(async ({ data, context }): Promise<ApiResponse<VersionSummary>> => {
    try {
      const userId = context.user.id

      const [version] = await db
        .select()
        .from(dashboardVersions)
        .where(eq(dashboardVersions.id, data.versionId))
        .limit(1)

      if (!version) {
        throw new NotFoundError('Version', data.versionId)
      }

      await verifyDashboardOwnership(version.dashboardId, userId)
      const snapshot = version.snapshot

      await db
        .update(dashboards)
        .set({
          name: snapshot.name,
          description: snapshot.description ?? null,
        })
        .where(eq(dashboards.id, version.dashboardId))

      await db.delete(pages).where(eq(pages.dashboardId, version.dashboardId))

      for (const pageData of snapshot.pages) {
        const [newPage] = await db
          .insert(pages)
          .values({
            dashboardId: version.dashboardId,
            name: pageData.name,
            sortOrder: pageData.sortOrder,
            layout: pageData.layout ?? null,
          })
          .returning()

        if (newPage && pageData.widgets.length > 0) {
          await db.insert(widgets).values(
            pageData.widgets.map((w) => ({
              pageId: newPage.id,
              type: w.type,
              title: w.title ?? null,
              x: w.x,
              y: w.y,
              w: w.w,
              h: w.h,
              config: w.config as Record<string, {}>,
            })),
          )
        }
      }

      const newVersion = await getNextVersionNumber(version.dashboardId)
      const newSnapshot = await createSnapshot(version.dashboardId)

      const [restoredVersion] = await db
        .insert(dashboardVersions)
        .values({
          dashboardId: version.dashboardId,
          version: newVersion,
          snapshot: newSnapshot,
          changeDescription: `Restored from version ${version.version}`,
        })
        .returning()

      if (!restoredVersion) {
        throw new Error('Failed to create restore version')
      }

      return {
        success: true,
        data: {
          id: restoredVersion.id,
          version: restoredVersion.version,
          changeDescription: restoredVersion.changeDescription,
          createdAt: restoredVersion.createdAt,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

const MAX_VERSIONS_PER_DASHBOARD = 50

export async function autoSaveVersion(
  dashboardId: string,
  changeDescription?: string,
): Promise<void> {
  const version = await getNextVersionNumber(dashboardId)

  if (version > MAX_VERSIONS_PER_DASHBOARD) {
    const [oldest] = await db
      .select({ id: dashboardVersions.id })
      .from(dashboardVersions)
      .where(eq(dashboardVersions.dashboardId, dashboardId))
      .orderBy(dashboardVersions.version)
      .limit(1)

    if (oldest) {
      await db
        .delete(dashboardVersions)
        .where(eq(dashboardVersions.id, oldest.id))
    }
  }

  const snapshot = await createSnapshot(dashboardId)

  await db.insert(dashboardVersions).values({
    dashboardId,
    version:
      version > MAX_VERSIONS_PER_DASHBOARD
        ? MAX_VERSIONS_PER_DASHBOARD
        : version,
    snapshot,
    changeDescription: changeDescription ?? null,
  })
}
