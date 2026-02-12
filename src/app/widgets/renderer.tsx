/**
 * Widget Renderer — Dynamically renders widgets from the registry.
 *
 * Handles lazy loading, error boundaries, and loading states.
 */
import { Suspense, useMemo } from 'react'
import { Loading03Icon } from '@hugeicons/core-free-icons'
import { WidgetErrorBoundary } from './error-boundary'
import { getWidget } from './registry'
import type { WidgetConfigSchema, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'

interface WidgetRendererProps {
  widgetId: string
  widgetType: string
  config: WidgetConfigSchema
  isEditing: boolean
  dimensions: { w: number; h: number }
  onConfigChange?: (config: Partial<WidgetConfigSchema>) => void
}

function WidgetLoadingFallback(): React.ReactElement {
  return (
    <GlassCard variant="solid" className="h-full p-4">
      <div className="flex h-full items-center justify-center">
        <Icon
          icon={Loading03Icon}
          size="lg"
          className="animate-spin text-white/40"
        />
      </div>
    </GlassCard>
  )
}

function WidgetNotFound({
  widgetType,
}: {
  widgetType: string
}): React.ReactElement {
  return (
    <GlassCard variant="solid" className="h-full p-4">
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-white/60">Unknown Widget</p>
        <p className="text-xs text-white/40">{widgetType}</p>
      </div>
    </GlassCard>
  )
}

export function WidgetRenderer({
  widgetId,
  widgetType,
  config,
  isEditing,
  dimensions,
  onConfigChange,
}: WidgetRendererProps): React.ReactElement {
  const entry = useMemo(() => getWidget(widgetType), [widgetType])

  if (!entry) {
    return <WidgetNotFound widgetType={widgetType} />
  }

  const { component: WidgetComponent, definition } = entry
  const isLazy = '_payload' in WidgetComponent

  const renderProps: WidgetRenderProps<WidgetConfigSchema> = {
    id: widgetId,
    config: { ...definition.defaultConfig, ...config },
    isEditing,
    dimensions,
    onConfigChange,
  }

  const content = isLazy ? (
    <Suspense fallback={<WidgetLoadingFallback />}>
      <WidgetComponent {...renderProps} />
    </Suspense>
  ) : (
    <WidgetComponent {...renderProps} />
  )

  return (
    <WidgetErrorBoundary widgetId={widgetId} widgetType={widgetType}>
      {content}
    </WidgetErrorBoundary>
  )
}

export default WidgetRenderer
