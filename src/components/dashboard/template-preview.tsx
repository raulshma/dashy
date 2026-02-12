/**
 * Template Preview — Miniature rendering of a template's layout structure.
 *
 * Shows pages as tabs and widgets as positioned blocks with type icons.
 */
import { useMemo, useState } from 'react'
import type { TemplateSchema } from '@server/db/schema/templates'
import { getWidgetDefinition } from '@/app/widgets'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  schema: TemplateSchema
  className?: string
  compact?: boolean
}

const WIDGET_COLORS: Record<string, string> = {
  'health-check': 'bg-emerald-500/20 border-emerald-500/40',
  'app-launcher': 'bg-blue-500/20 border-blue-500/40',
  rss: 'bg-orange-500/20 border-orange-500/40',
  weather: 'bg-sky-500/20 border-sky-500/40',
  iframe: 'bg-violet-500/20 border-violet-500/40',
  'api-fetch': 'bg-cyan-500/20 border-cyan-500/40',
  'json-renderer': 'bg-amber-500/20 border-amber-500/40',
  markdown: 'bg-purple-500/20 border-purple-500/40',
  notes: 'bg-yellow-500/20 border-yellow-500/40',
}

const DEFAULT_WIDGET_COLOR = 'bg-white/10 border-white/20'

const GRID_COLS = 12
const ROW_HEIGHT = 24

function WidgetBlock({
  widget,
  scale,
}: {
  widget: TemplateSchema['pages'][0]['widgets'][0]
  scale: number
}) {
  const definition = getWidgetDefinition(widget.type)
  const colorClass = WIDGET_COLORS[widget.type] ?? DEFAULT_WIDGET_COLOR

  const style = {
    left: `${(widget.x / GRID_COLS) * 100}%`,
    top: `${widget.y * ROW_HEIGHT * scale}px`,
    width: `${(widget.w / GRID_COLS) * 100}%`,
    height: `${widget.h * ROW_HEIGHT * scale}px`,
  }

  return (
    <div
      className={cn(
        'absolute rounded border transition-all',
        colorClass,
        'flex items-center justify-center overflow-hidden',
      )}
      style={style}
      title={widget.title || definition?.displayName || widget.type}
    >
      {definition?.icon && (
        <Icon
          icon={definition.icon as never}
          size={scale < 0.5 ? 'xs' : 'sm'}
          className="text-white/70 shrink-0"
        />
      )}
      {widget.title && scale >= 0.6 && (
        <span className="ml-1 truncate text-[9px] text-white/60">
          {widget.title}
        </span>
      )}
    </div>
  )
}

function PagePreview({
  page,
  scale,
}: {
  page: TemplateSchema['pages'][0]
  scale: number
}) {
  const gridHeight = useMemo(() => {
    if (page.widgets.length === 0) return ROW_HEIGHT * 4 * scale
    const maxY = Math.max(...page.widgets.map((w) => w.y + w.h))
    return Math.max(maxY * ROW_HEIGHT * scale, ROW_HEIGHT * 4 * scale)
  }, [page.widgets, scale])

  return (
    <div
      className="relative w-full rounded border border-white/10 bg-black/20"
      style={{ height: gridHeight }}
    >
      <div className="absolute inset-0 grid grid-cols-12 gap-px p-px opacity-20">
        {Array.from({ length: GRID_COLS }).map((_, i) => (
          <div key={i} className="border-r border-white/10 last:border-r-0" />
        ))}
      </div>
      {page.widgets.map((widget, idx) => (
        <WidgetBlock
          key={`${widget.type}-${idx}`}
          widget={widget}
          scale={scale}
        />
      ))}
      {page.widgets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">
          Empty page
        </div>
      )}
    </div>
  )
}

export function TemplatePreview({
  schema,
  className,
  compact = false,
}: TemplatePreviewProps) {
  const [activePage, setActivePage] = useState(0)

  const scale = compact ? 0.4 : 0.6
  const pages = schema.pages

  if (pages.length === 0) {
    return (
      <div
        className={cn(
          'flex h-24 items-center justify-center rounded border border-white/10 bg-black/20 text-sm text-white/30',
          className,
        )}
      >
        No pages
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {pages.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {pages.map((page, idx) => (
            <button
              key={idx}
              onClick={() => setActivePage(idx)}
              className={cn(
                'shrink-0 rounded-md px-2 py-1 text-xs transition-all',
                activePage === idx
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70',
              )}
            >
              {page.name || `Page ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      <PagePreview page={pages[activePage]} scale={scale} />

      {pages.length > 1 && (
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>
            Page {activePage + 1} of {pages.length}
          </span>
          <span>{pages[activePage].widgets.length} widgets</span>
        </div>
      )}
    </div>
  )
}

export function TemplateThumbnail({
  schema,
  className,
}: {
  schema: TemplateSchema
  className?: string
}) {
  const firstPage = schema.pages[0]
  const scale = 0.25

  if (!firstPage) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center bg-black/20 text-white/20',
          className,
        )}
      >
        <svg
          className="h-6 w-6 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      </div>
    )
  }

  const gridHeight = useMemo(() => {
    if (firstPage.widgets.length === 0) return 60
    const maxY = Math.max(...firstPage.widgets.map((w) => w.y + w.h))
    return Math.max(maxY * ROW_HEIGHT * scale, 60)
  }, [firstPage.widgets])

  return (
    <div
      className={cn('relative w-full rounded bg-black/20', className)}
      style={{ height: gridHeight }}
    >
      {firstPage.widgets.map((widget, idx) => (
        <WidgetBlock
          key={`${widget.type}-${idx}`}
          widget={widget}
          scale={scale}
        />
      ))}
    </div>
  )
}

export default TemplatePreview
