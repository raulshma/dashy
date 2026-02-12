/**
 * Plugin contracts — defines the manifest format and types for the plugin system.
 *
 * Import via: `import type { PluginManifest } from '@shared/contracts'`
 */
import { z } from 'zod'

export const pluginPermissionSchema = z.enum([
  'widgets',
  'commands',
  'ui',
  'network',
  'storage',
  'dashboard:read',
  'dashboard:write',
  'notifications',
])

export type PluginPermission = z.infer<typeof pluginPermissionSchema>

export const pluginAuthorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
})

export type PluginAuthor = z.infer<typeof pluginAuthorSchema>

export const semVerSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
    'Invalid semantic version',
  )

export type SemVer = z.infer<typeof semVerSchema>

export const pluginIdSchema = z
  .string()
  .regex(
    /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/,
    'Plugin ID must be in reverse domain format (e.g., com.example.my-plugin)',
  )

export type PluginId = z.infer<typeof pluginIdSchema>

export const pluginManifestSchema = z.object({
  id: pluginIdSchema,
  name: z.string().min(1).max(100),
  version: semVerSchema,
  description: z.string().min(1).max(500),
  author: pluginAuthorSchema,
  license: z.string().min(1),
  repository: z.string().url().optional(),
  homepage: z.string().url().optional(),
  main: z.string().min(1),
  types: z.string().optional(),
  icon: z.string().optional(),
  screenshots: z.array(z.string()).max(5).optional(),
  keywords: z.array(z.string().max(50)).max(10).optional(),
  engines: z.object({
    dashy: z.string().min(1),
  }),
  permissions: z.array(pluginPermissionSchema).default([]),
  networkAllowlist: z.array(z.string()).optional(),
  contributes: z
    .object({
      widgets: z.array(z.string()).optional(),
      commands: z.array(z.string()).optional(),
      settings: z.array(z.string()).optional(),
      themes: z.array(z.string()).optional(),
    })
    .optional(),
  activationEvents: z.array(z.string()).optional(),
  deprecated: z.boolean().default(false).optional(),
})

export type PluginManifest = z.infer<typeof pluginManifestSchema>

export const pluginStateSchema = z.enum([
  'installed',
  'activating',
  'running',
  'deactivating',
  'disabled',
  'error',
])

export type PluginState = z.infer<typeof pluginStateSchema>

export const pluginInstallSourceSchema = z.enum([
  'local',
  'npm',
  'url',
  'marketplace',
])

export type PluginInstallSource = z.infer<typeof pluginInstallSourceSchema>

export const pluginInstallInfoSchema = z.object({
  source: pluginInstallSourceSchema,
  installedAt: z.string().datetime(),
  installedBy: z.string().uuid(),
  installPath: z.string(),
  checksum: z.string().optional(),
})

export type PluginInstallInfo = z.infer<typeof pluginInstallInfoSchema>

export const pluginStatusSchema = z.object({
  id: pluginIdSchema,
  manifest: pluginManifestSchema,
  state: pluginStateSchema,
  installInfo: pluginInstallInfoSchema,
  lastActivated: z.string().datetime().optional(),
  lastDeactivated: z.string().datetime().optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      timestamp: z.string().datetime(),
    })
    .optional(),
  grantedPermissions: z.array(pluginPermissionSchema).default([]),
  deniedPermissions: z.array(pluginPermissionSchema).default([]),
})

export type PluginStatus = z.infer<typeof pluginStatusSchema>

export const pluginCommandSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  keybinding: z.string().optional(),
})

export type PluginCommand = z.infer<typeof pluginCommandSchema>

export const pluginSettingsDefinitionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  icon: z.string().optional(),
  order: z.number().int().min(0).optional(),
})

export type PluginSettingsDefinition = z.infer<
  typeof pluginSettingsDefinitionSchema
>

export const validatePluginManifest = (
  data: unknown,
): PluginManifest | { success: false; errors: z.ZodError } => {
  const result = pluginManifestSchema.safeParse(data)
  if (result.success) {
    return result.data
  }
  return { success: false, errors: result.error }
}

export const parsePluginId = (id: string): { domain: string; name: string } => {
  const parts = id.split('.')
  if (parts.length < 3) {
    throw new Error(`Invalid plugin ID: ${id}`)
  }
  const name = parts.pop()!
  const domain = parts.join('.')
  return { domain, name }
}
