/**
 * Widget contract — defines the interface that all widget implementations must follow.
 *
 * Import via: `import type { WidgetDefinition } from '@shared/contracts'`
 */
import type { z } from 'zod'

/**
 * Base configuration schema for a widget.
 * Each widget type defines its own config shape extending this.
 */
export type WidgetConfigSchema = Record<string, unknown>

/**
 * Generic widget definition inferred from a Zod schema.
 * Prefer this over manually specifying `WidgetDefinition<TConfig>`.
 */
export type Widget<TSchema extends z.ZodTypeAny> = Omit<
  WidgetDefinition<z.infer<TSchema> & WidgetConfigSchema>,
  'configSchema' | 'defaultConfig'
> & {
  configSchema: TSchema
  defaultConfig: z.infer<TSchema> & WidgetConfigSchema
}

/**
 * Props passed to every widget component at render time.
 */
export interface WidgetRenderProps<
  TConfig extends WidgetConfigSchema = WidgetConfigSchema,
> {
  /** Unique widget instance ID */
  id: string
  /** The resolved configuration for this widget instance */
  config: TConfig
  /** Whether the dashboard is in edit mode */
  isEditing: boolean
  /** Widget dimensions in grid units */
  dimensions: { w: number; h: number }
  /** Callback to request a config update */
  onConfigChange?: (config: Partial<TConfig>) => void
}

/**
 * Defines a widget that can be registered in the widget system.
 */
export interface WidgetDefinition<
  TConfig extends WidgetConfigSchema = WidgetConfigSchema,
> {
  /** Unique widget type identifier (e.g., 'health-check', 'weather') */
  type: string
  /** Human-readable display name */
  displayName: string
  /** Short description for the widget picker */
  description: string
  /** Icon identifier (HugeIcons name) */
  icon: string
  /** Category for grouping in the widget picker */
  category: WidgetCategory
  /** Zod schema for validating widget configuration */
  configSchema: z.ZodType<TConfig>
  /** Default configuration values for new instances */
  defaultConfig: TConfig
  /** Default grid size for new instances */
  defaultSize: { w: number; h: number }
  /** Minimum allowed grid size */
  minSize?: { w: number; h: number }
  /** Maximum allowed grid size */
  maxSize?: { w: number; h: number }
}

/**
 * Categories for organizing widgets in the picker.
 */
export type WidgetCategory =
  | 'monitoring'
  | 'productivity'
  | 'media'
  | 'utilities'
  | 'custom'
  | 'integrations'

/**
 * Lifecycle hooks that a widget can implement.
 */
export interface WidgetLifecycle {
  /** Called when the widget is first mounted */
  onMount?: () => void | Promise<void>
  /** Called when the widget is unmounted */
  onUnmount?: () => void
  /** Called when the widget configuration changes */
  onConfigChange?: (
    newConfig: WidgetConfigSchema,
    oldConfig: WidgetConfigSchema,
  ) => void
  /** Called when the widget should refresh its data */
  onRefresh?: () => void | Promise<void>
}

/**
 * Capabilities a widget can request access to.
 */
export type WidgetCapability =
  | 'network'
  | 'storage'
  | 'notifications'
  | 'clipboard'

/**
 * Permission status for a capability.
 */
export type PermissionStatus = 'granted' | 'denied' | 'prompt'

/**
 * A permission request for a widget capability.
 */
export interface WidgetPermissionRequest {
  capability: WidgetCapability
  reason: string
}

/**
 * Result of a permission request.
 */
export interface WidgetPermissionResult {
  capability: WidgetCapability
  status: PermissionStatus
}

/**
 * Map of capabilities to their current permission status.
 */
export type WidgetPermissions = Partial<
  Record<WidgetCapability, PermissionStatus>
>

/**
 * Permission check function type.
 */
export type PermissionChecker = (
  capability: WidgetCapability,
) => PermissionStatus

/**
 * Permission request function type.
 */
export type PermissionRequester = (
  request: WidgetPermissionRequest,
) => Promise<PermissionStatus>

/**
 * Complete widget registration entry combining definition, component, and metadata.
 */
export interface WidgetRegistryEntry<
  TConfig extends WidgetConfigSchema = WidgetConfigSchema,
> {
  /** The widget definition */
  definition: WidgetDefinition<TConfig>
  /** React component that renders the widget */
  component:
    | React.LazyExoticComponent<React.ComponentType<WidgetRenderProps<TConfig>>>
    | React.ComponentType<WidgetRenderProps<TConfig>>
  /** Required capabilities */
  capabilities?: Array<WidgetCapability>
}
