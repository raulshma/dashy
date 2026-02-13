/**
 * Backup Service
 *
 * Provides backup and restore functionality for dashboards and the full database.
 * Supports JSON exports for individual dashboards, user dashboards, and full DB backup.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { eq } from 'drizzle-orm'
import { closeDatabase, db } from '@server/db/connection'
import { dashboards, pages, users, widgets } from '@server/db/schema'
import { config } from '@server/config'

export interface DashboardExport {
  version: 1
  exportedAt: string
  dashboard: {
    id: string
    name: string
    slug: string
    description: string | null
    isPublic: boolean
    icon: string | null
    createdAt: string
    updatedAt: string
  }
  pages: Array<{
    id: string
    name: string
    icon: string | null
    sortOrder: number
    layout: Record<string, {}> | null
    widgets: Array<{
      id: string
      type: string
      title: string | null
      x: number
      y: number
      w: number
      h: number
      config: Record<string, {}>
    }>
  }>
}

export interface UserDashboardsExport {
  version: 1
  exportedAt: string
  user: {
    id: string
    email: string
    displayName: string
  }
  dashboards: Array<DashboardExport>
}

export interface FullBackupMetadata {
  version: 1
  exportedAt: string
  appVersion: string
  databasePath: string
  tables: Record<string, number>
}

export class BackupService {
  async exportDashboard(dashboardId: string): Promise<DashboardExport> {
    const [dashboard] = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, dashboardId))
      .limit(1)

    if (!dashboard) {
      throw new Error(`Dashboard not found: ${dashboardId}`)
    }

    const dashboardPages = await db
      .select()
      .from(pages)
      .where(eq(pages.dashboardId, dashboardId))

    const pagesWithWidgets = await Promise.all(
      dashboardPages.map(async (page) => {
        const pageWidgets = await db
          .select()
          .from(widgets)
          .where(eq(widgets.pageId, page.id))

        return {
          id: page.id,
          name: page.name,
          icon: page.icon,
          sortOrder: page.sortOrder,
          layout: page.layout as Record<string, {}> | null,
          widgets: pageWidgets.map((w) => ({
            id: w.id,
            type: w.type,
            title: w.title,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            config: w.config,
          })),
        }
      }),
    )

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        slug: dashboard.slug,
        description: dashboard.description,
        isPublic: dashboard.isPublic,
        icon: dashboard.icon,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
      },
      pages: pagesWithWidgets,
    }
  }

  async exportUserDashboards(userId: string): Promise<UserDashboardsExport> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    const userDashboards = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))

    const dashboardExports = await Promise.all(
      userDashboards.map((d) => this.exportDashboard(d.id)),
    )

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      dashboards: dashboardExports,
    }
  }

  async exportDashboardToJson(dashboardId: string): Promise<string> {
    const data = await this.exportDashboard(dashboardId)
    return JSON.stringify(data, null, 2)
  }

  async exportUserDashboardsToJson(userId: string): Promise<string> {
    const data = await this.exportUserDashboards(userId)
    return JSON.stringify(data, null, 2)
  }

  createFullDatabaseBackup(backupPath?: string): FullBackupMetadata {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const defaultBackupPath = path.join(
      path.dirname(config.database.path),
      `backups`,
    )

    const backupDir = backupPath ?? defaultBackupPath

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const backupFile = path.join(backupDir, `dashy-backup-${timestamp}.db`)

    const dbPath = config.database.path

    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`)
    }

    fs.copyFileSync(dbPath, backupFile)

    const walPath = `${dbPath}-wal`
    const shmPath = `${dbPath}-shm`

    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${backupFile}-wal`)
    }
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, `${backupFile}-shm`)
    }

    const metadata: FullBackupMetadata = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version ?? 'unknown',
      databasePath: backupFile,
      tables: this.getTableCounts(),
    }

    const metadataPath = `${backupFile}.meta.json`
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    return metadata
  }

  private getTableCounts(): Record<string, number> {
    const counts: Record<string, number> = {}

    const tableNames = [
      'users',
      'dashboards',
      'pages',
      'widgets',
      'widget_configs',
      'templates',
      'share_links',
      'dashboard_versions',
      'plugins',
      'plugin_storage',
    ]

    const sqlite = (
      db as unknown as {
        $client: { prepare: (sql: string) => { get: () => unknown } }
      }
    ).$client

    for (const name of tableNames) {
      try {
        const result = sqlite
          .prepare(`SELECT COUNT(*) as count FROM ${name}`)
          .get() as { count: number }
        counts[name] = result.count
      } catch {
        counts[name] = 0
      }
    }

    return counts
  }

  async importDashboard(
    exportData: DashboardExport,
    userId: string,
    options?: { overwrite?: boolean; newSlug?: string },
  ): Promise<string> {
    const { overwrite = false, newSlug } = options ?? {}

    const slug = newSlug ?? exportData.dashboard.slug

    const [existing] = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.slug, slug))
      .limit(1)

    let dashboardId: string

    if (existing) {
      if (!overwrite) {
        throw new Error(
          `Dashboard with slug "${slug}" already exists. Use overwrite=true to replace.`,
        )
      }
      dashboardId = existing.id
      await db.delete(dashboards).where(eq(dashboards.id, dashboardId))
    }

    const [newDashboard] = await db
      .insert(dashboards)
      .values({
        id: existing?.id ?? exportData.dashboard.id,
        userId,
        name: exportData.dashboard.name,
        slug,
        description: exportData.dashboard.description,
        isPublic: exportData.dashboard.isPublic,
        icon: exportData.dashboard.icon,
      })
      .returning()

    dashboardId = newDashboard.id

    for (const pageData of exportData.pages) {
      const [newPage] = await db
        .insert(pages)
        .values({
          id: pageData.id,
          dashboardId,
          name: pageData.name,
          icon: pageData.icon,
          sortOrder: pageData.sortOrder,
          layout: pageData.layout,
        })
        .returning()

      for (const widgetData of pageData.widgets) {
        await db.insert(widgets).values({
          id: widgetData.id,
          pageId: newPage.id,
          type: widgetData.type,
          title: widgetData.title,
          x: widgetData.x,
          y: widgetData.y,
          w: widgetData.w,
          h: widgetData.h,
          config: widgetData.config,
        })
      }
    }

    return dashboardId
  }

  restoreDatabaseFromBackup(backupFile: string): void {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`)
    }

    const metaFile = `${backupFile}.meta.json`
    if (!fs.existsSync(metaFile)) {
      throw new Error(`Backup metadata file not found: ${metaFile}`)
    }

    const metadata: FullBackupMetadata = JSON.parse(
      fs.readFileSync(metaFile, 'utf-8'),
    )

    if (metadata.version !== 1) {
      throw new Error(`Unsupported backup version: ${metadata.version}`)
    }

    closeDatabase()

    const dbPath = config.database.path
    fs.copyFileSync(backupFile, dbPath)

    const walPath = `${backupFile}-wal`
    const shmPath = `${backupFile}-shm`

    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${dbPath}-wal`)
    }
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, `${dbPath}-shm`)
    }
  }

  listBackups(
    backupDir?: string,
  ): Array<FullBackupMetadata & { file: string }> {
    const dir =
      backupDir ?? path.join(path.dirname(config.database.path), 'backups')

    if (!fs.existsSync(dir)) {
      return []
    }

    const files = fs.readdirSync(dir)
    const backups: Array<FullBackupMetadata & { file: string }> = []

    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        try {
          const content = fs.readFileSync(path.join(dir, file), 'utf-8')
          const metadata: FullBackupMetadata = JSON.parse(content)
          backups.push({
            ...metadata,
            file: metadata.databasePath,
          })
        } catch {
          // Skip invalid metadata files
        }
      }
    }

    return backups.sort(
      (a, b) =>
        new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime(),
    )
  }
}

export const backupService = new BackupService()
