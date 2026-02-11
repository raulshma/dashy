/**
 * Shared contracts — barrel export.
 *
 * Import contracts via: `import type { WidgetDefinition } from '@shared/contracts'`
 */
export type {
  WidgetConfigSchema,
  WidgetRenderProps,
  WidgetDefinition,
  WidgetCategory,
  WidgetLifecycle,
  WidgetCapability,
  WidgetRegistryEntry,
} from './widget'

export type {
  CreateDashboardInput,
  UpdateDashboardInput,
  CreatePageInput,
  AddWidgetInput,
  UpdateWidgetPositionInput,
  CreateShareLinkInput,
} from './dashboard'
