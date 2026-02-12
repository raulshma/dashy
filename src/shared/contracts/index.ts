/**
 * Shared contracts — barrel export.
 *
 * Import contracts via: `import type { WidgetDefinition } from '@shared/contracts'`
 */
export type {
  Widget,
  WidgetConfigSchema,
  WidgetRenderProps,
  WidgetDefinition,
  WidgetCategory,
  WidgetLifecycle,
  WidgetCapability,
  WidgetRegistryEntry,
  PermissionStatus,
  WidgetPermissionRequest,
  WidgetPermissionResult,
  WidgetPermissions,
  PermissionChecker,
  PermissionRequester,
} from './widget'

export type {
  CreateDashboardInput,
  UpdateDashboardInput,
  CreatePageInput,
  AddWidgetInput,
  UpdateWidgetPositionInput,
  CreateShareLinkInput,
} from './dashboard'

export type {
  RealtimeProtocolVersion,
  RealtimeMessageBase,
  RealtimeClientMessage,
  RealtimeServerMessage,
} from './realtime'

export type {
  PluginPermission,
  PluginAuthor,
  SemVer,
  PluginId,
  PluginManifest,
  PluginState,
  PluginInstallSource,
  PluginInstallInfo,
  PluginStatus,
  PluginCommand,
  PluginSettingsDefinition,
} from './plugin'

export {
  pluginPermissionSchema,
  pluginAuthorSchema,
  semVerSchema,
  pluginIdSchema,
  pluginManifestSchema,
  pluginStateSchema,
  pluginInstallSourceSchema,
  pluginInstallInfoSchema,
  pluginStatusSchema,
  pluginCommandSchema,
  pluginSettingsDefinitionSchema,
  validatePluginManifest,
  parsePluginId,
} from './plugin'
