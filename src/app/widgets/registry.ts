/**
 * Widget Registry — Central registration and lookup for all widget types.
 *
 * Import via: `import { widgetRegistry, registerWidget, getWidget } from '@/app/widgets/registry'`
 */
import type {
  WidgetConfigSchema,
  WidgetDefinition,
  WidgetRegistryEntry,
  WidgetRenderProps,
} from '@shared/contracts'

const registry = new Map<string, WidgetRegistryEntry>()

export function registerWidget<TConfig extends WidgetConfigSchema>(
  entry: WidgetRegistryEntry<TConfig>,
): void {
  const { definition } = entry
  if (registry.has(definition.type)) {
    console.warn(
      `[WidgetRegistry] Widget type "${definition.type}" is already registered. Overwriting.`,
    )
  }
  registry.set(definition.type, entry as WidgetRegistryEntry)
}

export function getWidget(type: string): WidgetRegistryEntry | undefined {
  return registry.get(type)
}

export function getWidgetDefinition(
  type: string,
): WidgetDefinition | undefined {
  return registry.get(type)?.definition
}

export function getAllWidgets(): Array<WidgetRegistryEntry> {
  return Array.from(registry.values())
}

export function getWidgetsByCategory(
  category: string,
): Array<WidgetRegistryEntry> {
  return Array.from(registry.values()).filter(
    (entry) => entry.definition.category === category,
  )
}

export function hasWidget(type: string): boolean {
  return registry.has(type)
}

export function unregisterWidget(type: string): boolean {
  return registry.delete(type)
}

export function clearRegistry(): void {
  registry.clear()
}

export const widgetRegistry = {
  register: registerWidget,
  get: getWidget,
  getDefinition: getWidgetDefinition,
  getAll: getAllWidgets,
  getByCategory: getWidgetsByCategory,
  has: hasWidget,
  unregister: unregisterWidget,
  clear: clearRegistry,
}

export type { WidgetDefinition, WidgetRegistryEntry, WidgetRenderProps }
