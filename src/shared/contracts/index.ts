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
