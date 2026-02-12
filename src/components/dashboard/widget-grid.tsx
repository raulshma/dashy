/**
 * Widget Grid System
 *
 * Grid-based drag & drop layout using react-grid-layout v2.
 * Includes mobile fallback (stacked layout), debounced persistence,
 * and virtualization for performance with many widgets.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { GridLayout, useContainerWidth } from 'react-grid-layout'
import type { Breakpoints, LayoutItem } from 'react-grid-layout'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { useIsMobile } from '@/hooks/use-responsive'
import {
  useWidgetVisibility,
  useObserveWidget,
} from '@/hooks/use-widget-visibility'
import 'react-grid-layout/css/styles.css'

const DEBOUNCE_MS = 300
const VIRTUALIZE_THRESHOLD = 10

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
  onWidgetConfigure?: (widgetId: string) => void
  onWidgetDuplicate?: (widgetId: string) => void
  onWidgetDelete?: (widgetId: string) => void
  renderWidgetContent?: (widget: WidgetItem) => React.ReactNode
  selectedWidgetId?: string | null
  className?: string
  enableVirtualization?: boolean
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
  isVisible = true,
  observeRef,
  onClick,
  onConfigure,
  onDuplicate,
  onDelete,
  children,
}: {
  widget: WidgetItem
  isSelected: boolean
  isEditable: boolean
  isVisible?: boolean
  observeRef?: (element: HTMLElement | null) => void
  onClick?: () => void
  onConfigure?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  children?: React.ReactNode
}) {
  return (
    <div ref={observeRef as React.Ref<HTMLDivElement>} className="h-full">
      <GlassCard
        variant="elevated"
        interactive
        padding="none"
        className={cn(
          'group h-full overflow-hidden relative',
          isSelected &&
            'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isEditable && 'cursor-move',
        )}
        onClick={onClick}
      >
        {isEditable && (
          <div
            className={cn(
              'absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-border/70 bg-background/85 p-1 shadow-sm backdrop-blur transition-opacity',
              isSelected
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Drag/Resize
            </span>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-muted transition-colors"
              onClick={onConfigure}
              aria-label="Configure widget"
            >
              Configure
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-muted transition-colors"
              onClick={onDuplicate}
              aria-label="Duplicate widget"
            >
              Duplicate
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              onClick={onDelete}
              aria-label="Delete widget"
            >
              Delete
            </button>
          </div>
        )}
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-sm font-medium truncate">
              {widget.title ?? widget.type}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {widget.type}
            </span>
          </div>
          <div className="flex-1 p-3 overflow-auto">
            {isVisible ? (
              (children ?? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {widget.type}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
                Loading...
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
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
  onWidgetConfigure,
  onWidgetDuplicate,
  onWidgetDelete,
  renderWidgetContent,
  selectedWidgetId,
  className,
  enableVirtualization = true,
}: WidgetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width } = useContainerWidth()
  const [layout, setLayout] = useState<ReadonlyArray<LayoutItem>>([])
  const isMobile = useIsMobile()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingLayoutRef = useRef<Array<WidgetLayout> | null>(null)

  const shouldVirtualize =
    enableVirtualization && widgets.length > VIRTUALIZE_THRESHOLD && !isMobile

  const widgetIds = widgets.map((w) => w.id)
  const { visibilityMap, observerRef } = useWidgetVisibility(widgetIds, {
    rootMargin: '200px',
    threshold: 0.01,
    debounceMs: 50,
  })

  useEffect(() => {
    const initialLayout: ReadonlyArray<LayoutItem> = widgets.map((w) =>
      widgetLayoutToLayoutItem(w.layout),
    )
    setLayout(initialLayout)
  }, [widgets])

  const debouncedOnLayoutChange = useCallback(
    (widgetLayouts: Array<WidgetLayout>) => {
      pendingLayoutRef.current = widgetLayouts

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        if (pendingLayoutRef.current) {
          onLayoutChange?.(pendingLayoutRef.current)
          pendingLayoutRef.current = null
        }
      }, DEBOUNCE_MS)
    },
    [onLayoutChange],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleLayoutChange = useCallback(
    (currentLayout: ReadonlyArray<LayoutItem>) => {
      setLayout(currentLayout)
      const widgetLayouts = currentLayout.map(layoutItemToWidgetLayout)
      debouncedOnLayoutChange(widgetLayouts)
    },
    [debouncedOnLayoutChange],
  )

  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className={cn('w-full flex flex-col gap-4', className)}
      >
        {widgets.map((widget) => (
          <WidgetSlot
            key={widget.id}
            widget={widget}
            isSelected={selectedWidgetId === widget.id}
            isEditable={false}
            onClick={() => onWidgetSelect?.(widget.id)}
          >
            {renderWidgetContent?.(widget)}
          </WidgetSlot>
        ))}
      </div>
    )
  }

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
        {widgets.map((widget) => {
          const isVisible = shouldVirtualize
            ? (visibilityMap[widget.id] ?? false)
            : true
          const observeRef = shouldVirtualize
            ? useObserveWidget(widget.id, observerRef.current)
            : undefined

          return (
            <div key={widget.id}>
              <WidgetSlot
                widget={widget}
                isSelected={selectedWidgetId === widget.id}
                isEditable={isEditable}
                isVisible={isVisible}
                observeRef={observeRef}
                onClick={() => onWidgetSelect?.(widget.id)}
                onConfigure={() => onWidgetConfigure?.(widget.id)}
                onDuplicate={() => onWidgetDuplicate?.(widget.id)}
                onDelete={() => onWidgetDelete?.(widget.id)}
              >
                {renderWidgetContent?.(widget)}
              </WidgetSlot>
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}

export { COLS, BREAKPOINTS }
