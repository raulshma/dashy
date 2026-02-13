/**
 * Public Share Link Route
 *
 * Renders a dashboard via share token in read-only mode.
 * Route: /share/:token
 */
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getPublicDashboardFn } from '@server/api/share-links'
import type { PublicDashboardDetail } from '@server/api/share-links'

import { getWidgetDefinition, WidgetRenderer } from '@/app/widgets'
import { Button } from '@/components/ui/button'
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

export const Route = createFileRoute('/share/$token')({
  validateSearch: z.object({
    page: z.string().optional(),
  }),
  component: SharedDashboardPage,
})

function SharedDashboardPage() {
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
        setDashboard(result.data)
        setPages(result.data.pages)

        const hasRequestedPage =
          requestedPageId !== undefined &&
          result.data.pages.some((p) => p.id === requestedPageId)
        const hasPreviousPage =
          activePageId !== null &&
          result.data.pages.some((p) => p.id === activePageId)

        const nextActivePageId = hasRequestedPage
          ? requestedPageId
          : hasPreviousPage
            ? activePageId
            : (result.data.pages[0]?.id ?? null)

        setActivePageId(nextActivePageId)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load shared dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [token, requestedPageId, activePageId])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const activePage = pages.find((p) => p.id === activePageId) ?? null

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-muted-foreground space-y-4">
        <svg
          className="animate-spin h-8 w-8 text-primary"
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
        <p>Loading shared dashboard...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center space-y-6 p-4">
        <div className="p-4 rounded-full bg-muted/50">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Share link not found
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {error ??
              'This share link does not exist, has expired, or has been revoked.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground truncate">
                {dashboard.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled>
            Read-only
          </Button>
        </div>
      </header>

      {pages.length > 1 && (
        <nav className="flex items-center gap-1 px-4 py-2 border-b bg-background/95 overflow-x-auto">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePageId(page.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
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

      <main className="flex-1 overflow-auto p-4">
        {activePage ? (
          activePage.widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center py-20">
              <p>This page has no widgets</p>
            </div>
          ) : (
            <SharedWidgetGrid widgets={activePage.widgets} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No page selected</p>
          </div>
        )}
      </main>
    </div>
  )
}

interface SharedWidgetGridProps {
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

function SharedWidgetGrid({ widgets }: SharedWidgetGridProps) {
  const GRID_COLUMNS = 12
  const ROW_HEIGHT = 80
  const GAP = 16

  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  const maxRow = Math.max(...widgets.map((w) => w.y + w.h), 0)
  const gridHeight = (maxRow + 1) * ROW_HEIGHT + maxRow * GAP

  return (
    <div
      className="relative w-full"
      style={{ height: `${gridHeight}px`, minWidth: '600px' }}
    >
      {sortedWidgets.map((widget) => {
        const definition = getWidgetDefinition(widget.type)
        if (!definition) {
          return (
            <GlassCard
              key={widget.id}
              className="absolute flex items-center justify-center"
              style={{
                left: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.x} + ${GAP}px * ${widget.x} / ${GRID_COLUMNS})`,
                top: `${widget.y * ROW_HEIGHT + widget.y * GAP}px`,
                width: `calc((100% - ${GAP}px) / ${GRID_COLUMNS} * ${widget.w} + ${GAP}px * ${widget.w - 1} / ${GRID_COLUMNS})`,
                height: `${widget.h * ROW_HEIGHT + (widget.h - 1) * GAP}px`,
              }}
            >
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Unknown widget type</p>
                <p className="text-xs mt-1 font-mono">{widget.type}</p>
              </div>
            </GlassCard>
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
