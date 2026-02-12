/**
 * Widget Grid System
 *
 * Grid-based drag & drop layout using react-grid-layout v2.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import type { Breakpoints, LayoutItem } from 'react-grid-layout'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import 'react-grid-layout/css/styles.css'

export interface WidgetLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
  static?: boolean
}

export interface WidgetItem {
  id: string
  type: string
  title: string | null
  config: Record<string, unknown>
  layout: WidgetLayout
}

interface WidgetGridProps {
  widgets: Array<WidgetItem>
  columns?: number
  rowHeight?: number
  gap?: number
  isEditable?: boolean
  onLayoutChange?: (layouts: Array<WidgetLayout>) => void
  onWidgetSelect?: (widgetId: string) => void
  selectedWidgetId?: string | null
  className?: string
}

const BREAKPOINTS: Breakpoints = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
}

const COLS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
}

function WidgetSlot({
  widget,
  isSelected,
  isEditable,
  onClick,
}: {
  widget: WidgetItem
  isSelected: boolean
  isEditable: boolean
  onClick?: () => void
}) {
  return (
    <GlassCard
      variant="elevated"
      interactive={!isEditable}
      padding="none"
      className={cn(
        'h-full overflow-hidden',
        isSelected &&
          'ring-2 ring-primary ring-offset-2 ring-offset-background',
        isEditable && 'cursor-move',
      )}
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-sm font-medium truncate">
            {widget.title ?? widget.type}
          </span>
          {isEditable && (
            <div className="flex items-center gap-1">
              <button
                className="p-1 rounded hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                aria-label="Widget settings"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {widget.type}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function layoutItemToWidgetLayout(item: LayoutItem): WidgetLayout {
  return {
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    maxW: item.maxW,
    minH: item.minH,
    maxH: item.maxH,
    static: item.static,
  }
}

function widgetLayoutToLayoutItem(layout: WidgetLayout): LayoutItem {
  return {
    i: layout.i,
    x: layout.x,
    y: layout.y,
    w: layout.w,
    h: layout.h,
    minW: layout.minW,
    maxW: layout.maxW,
    minH: layout.minH,
    maxH: layout.maxH,
    static: layout.static,
  }
}

export function WidgetGrid({
  widgets,
  columns = 12,
  rowHeight = 80,
  gap = 16,
  isEditable = false,
  onLayoutChange,
  onWidgetSelect,
  selectedWidgetId,
  className,
}: WidgetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useContainerWidth()
  const [layout, setLayout] = useState<ReadonlyArray<LayoutItem>>([])

  useEffect(() => {
    const initialLayout: ReadonlyArray<LayoutItem> = widgets.map((w) =>
      widgetLayoutToLayoutItem(w.layout),
    )
    setLayout(initialLayout)
  }, [widgets])

  const handleLayoutChange = useCallback(
    (currentLayout: ReadonlyArray<LayoutItem>) => {
      setLayout(currentLayout)
      const widgetLayouts = currentLayout.map(layoutItemToWidgetLayout)
      onLayoutChange?.(widgetLayouts)
    },
    [onLayoutChange],
  )

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      style={{ margin: -gap / 2 }}
    >
      <GridLayout
        width={width}
        layout={layout}
        gridConfig={{
          cols: columns,
          rowHeight,
          margin: [gap, gap],
          containerPadding: [0, 0],
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: isEditable,
          bounded: false,
        }}
        resizeConfig={{
          enabled: isEditable,
        }}
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map((widget) => (
          <div key={widget.id}>
            <WidgetSlot
              widget={widget}
              isSelected={selectedWidgetId === widget.id}
              isEditable={isEditable}
              onClick={() => onWidgetSelect?.(widget.id)}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  )
}

export { COLS, BREAKPOINTS }
