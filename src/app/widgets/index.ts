/**
 * Widget System — Barrel export.
 *
 * Import via: `import { widgetRegistry, WidgetRenderer } from '@/app/widgets'`
 */
export {
  widgetRegistry,
  registerWidget,
  getWidget,
  getWidgetDefinition,
  getAllWidgets,
  getWidgetsByCategory,
  hasWidget,
  unregisterWidget,
  clearRegistry,
} from './registry'

export { WidgetRenderer } from './renderer'
export { WidgetErrorBoundary } from './error-boundary'
export {
  WidgetSandboxProvider,
  useWidgetSandbox,
  useWidgetConfig,
  useWidgetLoading,
  useWidgetError,
} from './context'
export {
  WidgetPermissionsProvider,
  useWidgetPermissions,
  useCapability,
  useHasCapability,
} from './permissions'
export { registerBuiltinWidgets } from './implemented'

export type {
  WidgetDefinition,
  WidgetRegistryEntry,
  WidgetRenderProps,
  WidgetConfigSchema,
  WidgetLifecycle,
  WidgetCapability,
  WidgetCategory,
  WidgetPermissions,
  PermissionStatus,
  WidgetPermissionRequest,
} from '@shared/contracts'
