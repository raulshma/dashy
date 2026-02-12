/**
 * Plugin Permission System
 *
 * Manages plugin permissions including grant/deny decisions,
 * user prompts, and permission checks.
 */
import { eq } from 'drizzle-orm'
import { db } from '@server/db/connection'
import { plugins } from '@server/db/schema'
import type { PluginPermission, PluginId } from '@shared/contracts'

export type PermissionDecision = 'granted' | 'denied' | 'prompt'

export interface PermissionPromptRequest {
  pluginId: PluginId
  pluginName: string
  permissions: Array<{
    permission: PluginPermission
    reason?: string
  }>
}

export interface PermissionPromptResult {
  decisions: Record<PluginPermission, PermissionDecision>
  remember: boolean
}

class PermissionManager {
  private sessionDecisions = new Map<
    string,
    Map<PluginPermission, PermissionDecision>
  >()

  async checkPermission(
    pluginId: PluginId,
    permission: PluginPermission,
  ): Promise<PermissionDecision> {
    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) {
      return 'denied'
    }

    const grantedPermissions = JSON.parse(
      pluginRecord.grantedPermissions || '[]',
    ) as PluginPermission[]
    const deniedPermissions = JSON.parse(
      pluginRecord.deniedPermissions || '[]',
    ) as PluginPermission[]

    if (grantedPermissions.includes(permission)) {
      return 'granted'
    }

    if (deniedPermissions.includes(permission)) {
      return 'denied'
    }

    const sessionDecision = this.sessionDecisions.get(pluginId)?.get(permission)
    if (sessionDecision) {
      return sessionDecision
    }

    return 'prompt'
  }

  async grantPermission(
    pluginId: PluginId,
    permission: PluginPermission,
    persist: boolean = false,
  ): Promise<void> {
    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) return

    if (persist) {
      const grantedPermissions = JSON.parse(
        pluginRecord.grantedPermissions || '[]',
      ) as PluginPermission[]
      const deniedPermissions = JSON.parse(
        pluginRecord.deniedPermissions || '[]',
      ) as PluginPermission[]

      if (!grantedPermissions.includes(permission)) {
        grantedPermissions.push(permission)
      }

      const updatedDenied = deniedPermissions.filter((p) => p !== permission)

      await db
        .update(plugins)
        .set({
          grantedPermissions: JSON.stringify(grantedPermissions),
          deniedPermissions: JSON.stringify(updatedDenied),
        })
        .where(eq(plugins.id, pluginId))
    } else {
      if (!this.sessionDecisions.has(pluginId)) {
        this.sessionDecisions.set(pluginId, new Map())
      }
      this.sessionDecisions.get(pluginId)!.set(permission, 'granted')
    }
  }

  async denyPermission(
    pluginId: PluginId,
    permission: PluginPermission,
    persist: boolean = false,
  ): Promise<void> {
    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) return

    if (persist) {
      const grantedPermissions = JSON.parse(
        pluginRecord.grantedPermissions || '[]',
      ) as PluginPermission[]
      const deniedPermissions = JSON.parse(
        pluginRecord.deniedPermissions || '[]',
      ) as PluginPermission[]

      if (!deniedPermissions.includes(permission)) {
        deniedPermissions.push(permission)
      }

      const updatedGranted = grantedPermissions.filter((p) => p !== permission)

      await db
        .update(plugins)
        .set({
          grantedPermissions: JSON.stringify(updatedGranted),
          deniedPermissions: JSON.stringify(deniedPermissions),
        })
        .where(eq(plugins.id, pluginId))
    } else {
      if (!this.sessionDecisions.has(pluginId)) {
        this.sessionDecisions.set(pluginId, new Map())
      }
      this.sessionDecisions.get(pluginId)!.set(permission, 'denied')
    }
  }

  async getGrantedPermissions(pluginId: PluginId): Promise<PluginPermission[]> {
    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) return []

    return JSON.parse(
      pluginRecord.grantedPermissions || '[]',
    ) as PluginPermission[]
  }

  async getDeniedPermissions(pluginId: PluginId): Promise<PluginPermission[]> {
    const pluginRecord = await db.query.plugins.findFirst({
      where: eq(plugins.id, pluginId),
    })

    if (!pluginRecord) return []

    return JSON.parse(
      pluginRecord.deniedPermissions || '[]',
    ) as PluginPermission[]
  }

  async revokeAllPermissions(pluginId: PluginId): Promise<void> {
    await db
      .update(plugins)
      .set({
        grantedPermissions: '[]',
        deniedPermissions: '[]',
      })
      .where(eq(plugins.id, pluginId))

    this.sessionDecisions.delete(pluginId)
  }

  clearSessionDecisions(pluginId?: PluginId): void {
    if (pluginId) {
      this.sessionDecisions.delete(pluginId)
    } else {
      this.sessionDecisions.clear()
    }
  }

  getPermissionDescription(permission: PluginPermission): string {
    const descriptions: Record<PluginPermission, string> = {
      widgets: 'Register custom widgets in the dashboard',
      commands: 'Add commands to the command palette',
      ui: 'Modify the user interface and add panels',
      network: 'Make network requests to external servers',
      storage: 'Store and retrieve plugin data',
      'dashboard:read': 'Read dashboard and widget configurations',
      'dashboard:write': 'Create, modify, and delete dashboards and widgets',
      notifications: 'Display toast notifications',
    }
    return descriptions[permission] || 'Unknown permission'
  }

  getPermissionRisk(permission: PluginPermission): 'low' | 'medium' | 'high' {
    const riskLevels: Record<PluginPermission, 'low' | 'medium' | 'high'> = {
      widgets: 'low',
      commands: 'low',
      ui: 'medium',
      network: 'high',
      storage: 'low',
      'dashboard:read': 'medium',
      'dashboard:write': 'high',
      notifications: 'low',
    }
    return riskLevels[permission] || 'medium'
  }

  validatePermissions(
    requested: PluginPermission[],
    declared: PluginPermission[],
  ): { valid: boolean; extra: PluginPermission[] } {
    const extra = requested.filter((p) => !declared.includes(p))
    return {
      valid: extra.length === 0,
      extra,
    }
  }
}

export const permissionManager = new PermissionManager()

export function createPermissionGuard(
  pluginId: PluginId,
  permission: PluginPermission,
) {
  return async <T>(
    action: () => T | Promise<T>,
  ): Promise<
    T | { error: 'permission_denied'; permission: PluginPermission }
  > => {
    const decision = await permissionManager.checkPermission(
      pluginId,
      permission,
    )

    if (decision === 'granted') {
      return action()
    }

    return { error: 'permission_denied', permission }
  }
}
