/**
 * Embed Route for Share Links
 *
 * Minimal chromeless view for iframe embedding.
 * Route: /embed/:token
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getPublicDashboardFn } from '@server/api/share-links'
import type { PublicDashboardDetail } from '@server/api/share-links'

import { getWidgetDefinition, WidgetRenderer } from '@/app/widgets'
import { GlassCard } from '@/components/ui/glass-card'

interface SharedPageData {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  widgets: Array<{
    id: string
    type: string
    title: string | null
    config: Record<string, unknown>
    x: number
    y: number
    w: number
    h: number
  }>
}

export const Route = createFileRoute('/embed/$token')({
  validateSearch: z.object({
    page: z.string().optional(),
  }),
  component: EmbeddedDashboardPage,
})

function EmbeddedDashboardPage() {
  const { token } = Route.useParams()
  const { page: requestedPageId } = Route.useSearch()

  const [dashboard, setDashboard] = useState<
    (PublicDashboardDetail & { mode: 'read-only' | 'embed' }) | null
  >(null)
  const [pages, setPages] = useState<Array<SharedPageData>>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getPublicDashboardFn({ data: { token } })

      if (result.success && result.data) {
        if (result.data.mode !== 'embed') {
          setError('This link is not configured for embed mode')
          return
        }
        setDashboard(result.data)
        setPages(result.data.pages)

        const hasRequestedPage =
          requestedPageId !== undefined &&
          result.data.pages.some((p) => p.id === requestedPageId)

        const nextActivePageId = hasRequestedPage
          ? requestedPageId
          : (result.data.pages[0]?.id ?? null)

        setActivePageId(nextActivePageId)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load embedded dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [token, requestedPageId])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const activePage = pages.find((p) => p.id === activePageId) ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-background">
        <svg
          className="animate-spin h-6 w-6 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-background text-muted-foreground text-sm">
        {error ?? 'Unable to load dashboard'}
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-background overflow-hidden flex flex-col">
      {pages.length > 1 && (
        <nav className="flex items-center gap-1 px-2 py-1 border-b bg-background/95 overflow-x-auto shrink-0">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePageId(page.id)}
              className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                page.id === activePageId
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {page.name}
            </button>
          ))}
        </nav>
      )}

      <main className="flex-1 overflow-auto p-2">
        {activePage && activePage.widgets.length > 0 ? (
          <EmbeddedWidgetGrid widgets={activePage.widgets} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No widgets
          </div>
        )}
      </main>
    </div>
  )
}

interface EmbeddedWidgetGridProps {
  widgets: Array<{
    id: string
    type: string
    title: string | null
    config: Record<string, unknown>
    x: number
    y: number
    w: number
    h: number
  }>
}

function EmbeddedWidgetGrid({ widgets }: EmbeddedWidgetGridProps) {
  const GRID_COLUMNS = 12
  const ROW_HEIGHT = 60
  const GAP = 8

  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  const maxRow = Math.max(...widgets.map((w) => w.y + w.h), 0)
  const gridHeight = (maxRow + 1) * ROW_HEIGHT + maxRow * GAP

  return (
    <div
      className="relative w-full"
      style={{ height: `${gridHeight}px`, minWidth: '300px' }}
    >
      {sortedWidgets.map((widget) => {
        const definition = getWidgetDefinition(widget.type)
        if (!definition) {
          return (
            <div
              key={widget.id}
              className="absolute flex items-center justify-center bg-muted/30 rounded text-muted-foreground text-xs"
              style={{
                left: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.x} + ${GAP}px * ${widget.x} / ${GRID_COLUMNS})`,
                top: `${widget.y * ROW_HEIGHT + widget.y * GAP}px`,
                width: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.w} + ${GAP}px * ${widget.w - 1} / ${GRID_COLUMNS})`,
                height: `${widget.h * ROW_HEIGHT + (widget.h - 1) * GAP}px`,
              }}
            >
              Unknown: {widget.type}
            </div>
          )
        }

        return (
          <GlassCard
            key={widget.id}
            className="absolute overflow-hidden"
            style={{
              left: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.x} + ${GAP}px * ${widget.x} / ${GRID_COLUMNS})`,
              top: `${widget.y * ROW_HEIGHT + widget.y * GAP}px`,
              width: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.w} + ${GAP}px * ${widget.w - 1} / ${GRID_COLUMNS})`,
              height: `${widget.h * ROW_HEIGHT + (widget.h - 1) * GAP}px`,
            }}
          >
            <div className="h-full w-full overflow-hidden">
              <WidgetRenderer
                widgetId={widget.id}
                widgetType={widget.type}
                config={{
                  ...definition.defaultConfig,
                  ...widget.config,
                }}
                isEditing={false}
                dimensions={{ w: widget.w, h: widget.h }}
              />
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}
