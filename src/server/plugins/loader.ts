/**
 * Plugin Loader — Discovers, loads, and manages plugin lifecycle.
 *
 * Handles plugin discovery from filesystem, manifest validation,
 * dynamic loading, and lifecycle management.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { db } from '@server/db/connection'
import { plugins, pluginStorage } from '@server/db/schema'
import { pluginManifestSchema, validatePluginManifest } from '@shared/contracts'
import type {
  PluginId,
  PluginInstallSource,
  PluginManifest,
  PluginState,
} from '@shared/contracts'

const PLUGINS_DIR = join(process.cwd(), 'plugins')
const DASHY_VERSION = '1.0.0'

export interface PluginModule {
  activate?: (context: unknown) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

export interface LoadedPlugin {
  id: PluginId
  manifest: PluginManifest
  module: PluginModule
  state: PluginState
  installPath: string
}

class PluginLoader {
  private loadedPlugins = new Map<PluginId, LoadedPlugin>()

  discoverPlugins(): Promise<Array<PluginManifest>> {
    const discovered: Array<PluginManifest> = []

    if (!existsSync(PLUGINS_DIR)) {
      return Promise.resolve(discovered)
    }

    const entries = readdirSync(PLUGINS_DIR, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const pluginDir = join(PLUGINS_DIR, entry.name)
      const manifestPath = join(pluginDir, 'plugin.json')

      if (!existsSync(manifestPath)) {
        console.warn(`[PluginLoader] No plugin.json found in ${pluginDir}`)
        continue
      }

      try {
        const manifestContent = readFileSync(manifestPath, 'utf-8')
        const manifestJson = JSON.parse(manifestContent)
        const manifest = validatePluginManifest(manifestJson)

        if ('errors' in manifest) {
          console.error(
            `[PluginLoader] Invalid manifest in ${pluginDir}:`,
            manifest.errors.issues.map((i) => i.message).join(', '),
          )
          continue
        }

        if (!this.isVersionCompatible(manifest.engines.dashy)) {
          console.warn(
            `[PluginLoader] Plugin ${manifest.id} requires Dashy ${manifest.engines.dashy}, but running ${DASHY_VERSION}`,
          )
          continue
        }

        discovered.push(manifest)
      } catch (error) {
        console.error(
          `[PluginLoader] Failed to parse manifest in ${pluginDir}:`,
          error,
        )
      }
    }

    return Promise.resolve(discovered)
  }

  async installPlugin(
    source: PluginInstallSource,
    installPath: string,
    userId: string,
  ): Promise<
    { success: true; id: PluginId } | { success: false; error: string }
  > {
    const manifestPath = join(installPath, 'plugin.json')

    if (!existsSync(manifestPath)) {
      return { success: false, error: 'plugin.json not found' }
    }

    try {
      const manifestContent = readFileSync(manifestPath, 'utf-8')
      const manifestJson = JSON.parse(manifestContent)
      const manifest = validatePluginManifest(manifestJson)

      if ('errors' in manifest) {
        return {
          success: false,
          error: `Invalid manifest: ${manifest.errors.issues.map((i) => i.message).join(', ')}`,
        }
      }

      const existing = await db.query.plugins.findFirst({
        where: eq(plugins.id, manifest.id),
      })

      if (existing) {
        return { success: false, error: 'Plugin already installed' }
      }

      const entryPointPath = join(installPath, manifest.main)
      if (!existsSync(entryPointPath)) {
        return {
          success: false,
          error: `Entry point not found: ${manifest.main}`,
        }
      }

      const checksum = this.calculateChecksum(installPath)

      await db.insert(plugins).values({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        authorName: manifest.author.name,
        authorEmail: manifest.author.email,
        authorUrl: manifest.author.url,
        license: manifest.license,
        repository: manifest.repository,
        homepage: manifest.homepage,
        main: manifest.main,
        types: manifest.types,
        icon: manifest.icon,
        screenshots: manifest.screenshots?.join(','),
        keywords: manifest.keywords?.join(','),
        enginesDashy: manifest.engines.dashy,
        permissions: JSON.stringify(manifest.permissions),
        networkAllowlist: manifest.networkAllowlist?.join(','),
        contributes: manifest.contributes
          ? JSON.stringify(manifest.contributes)
          : null,
        activationEvents: manifest.activationEvents?.join(','),
        deprecated: manifest.deprecated ?? false,
        installedBy: userId,
        installSource: source,
        installPath,
        checksum,
        state: 'installed',
      })

      return { success: true, id: manifest.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async loadPlugin(pluginId: PluginId): Promise<LoadedPlugin | null> {
    if (this.loadedPlugins.has(pluginId)) {
      return this.loadedPlugins.get(pluginId)!
    }

    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) {
      return null
    }

    const manifestContent = readFileSync(
      join(pluginRecord.installPath, 'plugin.json'),
      'utf-8',
    )
    const manifest = pluginManifestSchema.parse(JSON.parse(manifestContent))

    await db
      .update(plugins)
      .set({ state: 'activating' })
      .where(eq(plugins.id, pluginId))

    try {
      const entryPointPath = join(pluginRecord.installPath, manifest.main)

      const module = (await import(/* @vite-ignore */ entryPointPath)) as {
        default?: PluginModule
      } & PluginModule

      const loadedPlugin: LoadedPlugin = {
        id: pluginId,
        manifest,
        module: module.default ?? module,
        state: 'running',
        installPath: pluginRecord.installPath,
      }

      await db
        .update(plugins)
        .set({
          state: 'running',
          lastActivated: new Date().toISOString(),
          errorMessage: null,
          errorStack: null,
          errorTimestamp: null,
        })
        .where(eq(plugins.id, pluginId))

      this.loadedPlugins.set(pluginId, loadedPlugin)

      return loadedPlugin
    } catch (error) {
      await db
        .update(plugins)
        .set({
          state: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : null,
          errorTimestamp: new Date().toISOString(),
        })
        .where(eq(plugins.id, pluginId))

      return null
    }
  }

  async unloadPlugin(pluginId: PluginId): Promise<boolean> {
    const loadedPlugin = this.loadedPlugins.get(pluginId)

    if (!loadedPlugin) {
      return false
    }

    await db
      .update(plugins)
      .set({ state: 'deactivating' })
      .where(eq(plugins.id, pluginId))

    try {
      if (
        loadedPlugin.module &&
        typeof loadedPlugin.module.deactivate === 'function'
      ) {
        await loadedPlugin.module.deactivate()
      }

      this.loadedPlugins.delete(pluginId)

      await db
        .update(plugins)
        .set({
          state: 'installed',
          lastDeactivated: new Date().toISOString(),
        })
        .where(eq(plugins.id, pluginId))

      return true
    } catch (error) {
      await db
        .update(plugins)
        .set({
          state: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : null,
          errorTimestamp: new Date().toISOString(),
        })
        .where(eq(plugins.id, pluginId))

      return false
    }
  }

  async uninstallPlugin(pluginId: PluginId): Promise<boolean> {
    await this.unloadPlugin(pluginId)

    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) {
      return false
    }

    await db.delete(pluginStorage).where(eq(pluginStorage.pluginId, pluginId))
    await db.delete(plugins).where(eq(plugins.id, pluginId))

    return true
  }

  getLoadedPlugin(pluginId: PluginId): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId)
  }

  getAllLoadedPlugins(): Array<LoadedPlugin> {
    return Array.from(this.loadedPlugins.values())
  }

  async getPluginStatus(pluginId: PluginId) {
    return db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })
  }

  async getAllPluginStatuses() {
    return db.query.plugins.findMany()
  }

  async enablePlugin(pluginId: PluginId): Promise<boolean> {
    const plugin = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!plugin) return false

    if (plugin.state === 'disabled') {
      await db
        .update(plugins)
        .set({ state: 'installed' })
        .where(eq(plugins.id, pluginId))
    }

    return this.loadPlugin(pluginId) !== null
  }

  async disablePlugin(pluginId: PluginId): Promise<boolean> {
    await this.unloadPlugin(pluginId)

    await db
      .update(plugins)
      .set({ state: 'disabled' })
      .where(eq(plugins.id, pluginId))

    return true
  }

  private isVersionCompatible(versionRange: string): boolean {
    const cleanRange = versionRange.replace(/[\^~>=<]/g, '').split('.')[0]
    const currentMajor = DASHY_VERSION.split('.')[0]
    return cleanRange === currentMajor || versionRange.includes('>=')
  }

  private calculateChecksum(pluginPath: string): string {
    const hash = createHash('sha256')
    const manifestPath = join(pluginPath, 'plugin.json')
    const mainPath = join(
      pluginPath,
      JSON.parse(readFileSync(manifestPath, 'utf-8')).main,
    )

    if (existsSync(manifestPath)) {
      hash.update(readFileSync(manifestPath))
    }

    if (existsSync(mainPath)) {
      hash.update(readFileSync(mainPath))
    }

    return hash.digest('hex').substring(0, 16)
  }
}

export const pluginLoader = new PluginLoader()

export type { PluginManifest, PluginId, PluginState, PluginInstallSource }
