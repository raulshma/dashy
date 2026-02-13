import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { getDashboardFn, listDashboardsFn } from '@server/api/dashboards'
import {
  addWidgetFn,
  deleteWidgetFn,
  duplicateWidgetFn,
  updateWidgetConfigFn,
} from '@server/api/widgets'
import type { DashboardSummary } from '@server/api/dashboards'
import { getAllWidgets, getWidget } from '@/app/widgets'
import { useAuth } from '@/hooks/use-auth'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

const DASHBOARD_CACHE_MS = 60_000
const SEARCH_INDEX_CACHE_MS = 60_000
const MAX_CONFIG_INDEX_CHARS = 300

interface DashboardIndexItem {
  kind: 'dashboard' | 'page' | 'widget'
  id: string
  dashboardSlug: string
  dashboardName: string
  pageId?: string
  pageName?: string
  widgetType?: string
  widgetTitle?: string | null
  value: string
}

function toSearchableConfig(config: unknown): string {
  if (!config || typeof config !== 'object') return ''

  try {
    return JSON.stringify(config)
      .replace(/[{}[\]",:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CONFIG_INDEX_CHARS)
  } catch {
    return ''
  }
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  return target.closest('[contenteditable="true"], [role="textbox"]') !== null
}

export function GlobalCommandPalette(): React.ReactElement {
  const navigate = useNavigate()
  const location = useRouterState({
    select: (state) => state.location,
  })
  const pathname = location.pathname
  const { isAuthenticated, isLoading, logout } = useAuth()

  const [open, setOpen] = useState(false)
  const [dashboards, setDashboards] = useState<Array<DashboardSummary>>([])
  const [searchIndex, setSearchIndex] = useState<Array<DashboardIndexItem>>([])
  const [dashboardsLoading, setDashboardsLoading] = useState(false)
  const [searchIndexLoading, setSearchIndexLoading] = useState(false)
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0)
  const [lastSearchIndexFetchedAt, setLastSearchIndexFetchedAt] =
    useState<number>(0)

  const shouldRefreshDashboards = useMemo(
    () => Date.now() - lastFetchedAt > DASHBOARD_CACHE_MS,
    [lastFetchedAt],
  )

  const shouldRefreshSearchIndex = useMemo(
    () => Date.now() - lastSearchIndexFetchedAt > SEARCH_INDEX_CACHE_MS,
    [lastSearchIndexFetchedAt],
  )

  const currentDashboardSlug = useMemo(() => {
    const match = pathname.match(/^\/dashboards\/([^/?#]+)/)
    return match?.[1] ?? null
  }, [pathname])

  const activePageId =
    typeof location.search === 'object' &&
    location.search !== null &&
    'page' in location.search &&
    typeof location.search.page === 'string'
      ? location.search.page
      : null

  const availableWidgets = useMemo(() => getAllWidgets(), [])

  const currentPageWidgets = useMemo(() => {
    if (!currentDashboardSlug || !activePageId) return []

    return searchIndex.filter(
      (item) =>
        item.kind === 'widget' &&
        item.dashboardSlug === currentDashboardSlug &&
        item.pageId === activePageId,
    )
  }, [activePageId, currentDashboardSlug, searchIndex])

  const fetchDashboards = useCallback(async () => {
    if (!isAuthenticated) return []

    setDashboardsLoading(true)

    try {
      const result = await listDashboardsFn({
        data: {
          page: 1,
          limit: 25,
          sortBy: 'updatedAt',
          sortDir: 'desc',
        },
      })

      if (result.success && result.data) {
        setDashboards(result.data.items)
        setLastFetchedAt(Date.now())
        return result.data.items
      }

      return []
    } finally {
      setDashboardsLoading(false)
    }
  }, [isAuthenticated])

  const fetchSearchIndex = useCallback(
    async (dashboardList: Array<DashboardSummary>) => {
      if (!isAuthenticated || dashboardList.length === 0) {
        setSearchIndex([])
        setLastSearchIndexFetchedAt(Date.now())
        return
      }

      setSearchIndexLoading(true)

      try {
        const dashboardDetails = await Promise.all(
          dashboardList.map((dashboard) =>
            getDashboardFn({
              data: {
                identifier: dashboard.id,
                includeWidgets: true,
              },
            }),
          ),
        )

        const items: Array<DashboardIndexItem> = []

        dashboardDetails.forEach((detailResult) => {
          if (!detailResult.success || !detailResult.data) return

          const dashboard = detailResult.data

          items.push({
            kind: 'dashboard',
            id: dashboard.id,
            dashboardSlug: dashboard.slug,
            dashboardName: dashboard.name,
            value: `${dashboard.name} ${dashboard.slug} dashboard`,
          })

          dashboard.pages.forEach((page) => {
            items.push({
              kind: 'page',
              id: `${dashboard.id}:${page.id}`,
              dashboardSlug: dashboard.slug,
              dashboardName: dashboard.name,
              pageId: page.id,
              pageName: page.name,
              value: `${page.name} page ${dashboard.name} ${dashboard.slug}`,
            })

            page.widgets?.forEach((widget) => {
              const searchableConfig = toSearchableConfig(widget.config)
              items.push({
                kind: 'widget',
                id: widget.id,
                dashboardSlug: dashboard.slug,
                dashboardName: dashboard.name,
                pageId: page.id,
                pageName: page.name,
                widgetType: widget.type,
                widgetTitle: widget.title,
                value: `${widget.title ?? ''} ${widget.type} widget ${page.name} ${dashboard.name} ${dashboard.slug} ${searchableConfig}`,
              })
            })
          })
        })

        setSearchIndex(items)
        setLastSearchIndexFetchedAt(Date.now())
      } finally {
        setSearchIndexLoading(false)
      }
    },
    [isAuthenticated],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)

      if (!isShortcut || event.altKey) return
      if (isTextInputTarget(event.target)) return

      event.preventDefault()
      setOpen((prev) => !prev)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || !isAuthenticated) return

    void (async () => {
      const dashboardList =
        !shouldRefreshDashboards && dashboards.length > 0
          ? dashboards
          : await fetchDashboards()

      if (shouldRefreshSearchIndex || searchIndex.length === 0) {
        await fetchSearchIndex(dashboardList)
      }
    })()
  }, [
    dashboards.length,
    dashboards,
    fetchSearchIndex,
    fetchDashboards,
    isAuthenticated,
    open,
    searchIndex.length,
    shouldRefreshDashboards,
    shouldRefreshSearchIndex,
  ])

  const goTo = useCallback(
    (to: '/dashboards' | '/settings' | '/auth/login' | '/auth/register') => {
      setOpen(false)
      void navigate({ to })
    },
    [navigate],
  )

  const goToDashboard = useCallback(
    (slug: string) => {
      setOpen(false)
      void navigate({ to: '/dashboards/$slug', params: { slug } })
    },
    [navigate],
  )

  const goToDashboardPage = useCallback(
    (slug: string, pageId: string) => {
      setOpen(false)
      void navigate({
        to: '/dashboards/$slug',
        params: { slug },
        search: { page: pageId },
      })
    },
    [navigate],
  )

  const refreshPaletteData = useCallback(async () => {
    const dashboardList = await fetchDashboards()
    await fetchSearchIndex(dashboardList)
  }, [fetchDashboards, fetchSearchIndex])

  const handleAddWidget = useCallback(
    async (
      widgetType: string,
      defaultSize: { w: number; h: number },
      defaultConfig: Record<string, unknown>,
    ) => {
      if (!activePageId) return

      await addWidgetFn({
        data: {
          pageId: activePageId,
          type: widgetType,
          x: 0,
          y: 0,
          w: defaultSize.w,
          h: defaultSize.h,
          config: defaultConfig,
        },
      })

      await refreshPaletteData()
      setOpen(false)
    },
    [activePageId, refreshPaletteData],
  )

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      await deleteWidgetFn({ data: { id: widgetId } })
      await refreshPaletteData()
      setOpen(false)
    },
    [refreshPaletteData],
  )

  const handleDuplicateWidget = useCallback(
    async (widgetId: string) => {
      await duplicateWidgetFn({
        data: {
          id: widgetId,
          offsetX: 1,
          offsetY: 1,
        },
      })
      await refreshPaletteData()
      setOpen(false)
    },
    [refreshPaletteData],
  )

  const handleResetWidgetConfig = useCallback(
    async (widgetId: string, widgetType: string) => {
      const widgetEntry = getWidget(widgetType)
      if (!widgetEntry) return

      await updateWidgetConfigFn({
        data: {
          id: widgetId,
          config: widgetEntry.definition.defaultConfig,
        },
      })

      await refreshPaletteData()
      setOpen(false)
    },
    [refreshPaletteData],
  )

  const handleLogout = useCallback(async () => {
    setOpen(false)
    await logout()
  }, [logout])

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global Command Palette"
        description="Run navigation and session commands quickly."
      >
        <Command>
          <CommandInput placeholder="Type a command or search dashboards..." />
          <CommandList>
            <CommandEmpty>No matching commands.</CommandEmpty>

            {!isLoading && (
              <>
                <CommandGroup heading="Navigation">
                  {isAuthenticated ? (
                    <>
                      <CommandItem onSelect={() => goTo('/dashboards')}>
                        Open dashboards
                        <CommandShortcut>G D</CommandShortcut>
                      </CommandItem>
                      <CommandItem onSelect={() => goTo('/settings')}>
                        Open account settings
                        <CommandShortcut>G S</CommandShortcut>
                      </CommandItem>
                    </>
                  ) : (
                    <>
                      <CommandItem onSelect={() => goTo('/auth/login')}>
                        Go to login
                        <CommandShortcut>G L</CommandShortcut>
                      </CommandItem>
                      <CommandItem onSelect={() => goTo('/auth/register')}>
                        Go to register
                        <CommandShortcut>G R</CommandShortcut>
                      </CommandItem>
                    </>
                  )}
                </CommandGroup>

                {isAuthenticated && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Dashboards">
                      {dashboardsLoading && dashboards.length === 0 ? (
                        <CommandItem disabled>
                          Loading dashboards...
                        </CommandItem>
                      ) : dashboards.length > 0 ? (
                        dashboards.map((dashboard) => (
                          <CommandItem
                            key={dashboard.id}
                            onSelect={() => goToDashboard(dashboard.slug)}
                            value={`${dashboard.name} ${dashboard.slug} dashboard`}
                          >
                            {dashboard.name}
                          </CommandItem>
                        ))
                      ) : (
                        <CommandItem disabled>No dashboards found.</CommandItem>
                      )}
                    </CommandGroup>

                    <CommandSeparator />
                    <CommandGroup heading="Search Index">
                      {searchIndexLoading && searchIndex.length === 0 ? (
                        <CommandItem disabled>
                          Building search index...
                        </CommandItem>
                      ) : searchIndex.length > 0 ? (
                        searchIndex.map((item) => {
                          if (item.kind === 'dashboard') {
                            return (
                              <CommandItem
                                key={`idx-dashboard-${item.id}`}
                                onSelect={() =>
                                  goToDashboard(item.dashboardSlug)
                                }
                                value={item.value}
                              >
                                Dashboard: {item.dashboardName}
                              </CommandItem>
                            )
                          }

                          if (
                            item.kind === 'page' &&
                            item.pageId &&
                            item.pageName
                          ) {
                            return (
                              <CommandItem
                                key={`idx-page-${item.id}`}
                                onSelect={() =>
                                  goToDashboardPage(
                                    item.dashboardSlug,
                                    item.pageId!,
                                  )
                                }
                                value={item.value}
                              >
                                Page: {item.pageName} · {item.dashboardName}
                              </CommandItem>
                            )
                          }

                          if (item.kind === 'widget' && item.pageId) {
                            return (
                              <CommandItem
                                key={`idx-widget-${item.id}`}
                                onSelect={() =>
                                  goToDashboardPage(
                                    item.dashboardSlug,
                                    item.pageId!,
                                  )
                                }
                                value={item.value}
                              >
                                Widget: {item.widgetTitle ?? item.widgetType} ·{' '}
                                {item.pageName}
                              </CommandItem>
                            )
                          }

                          return null
                        })
                      ) : (
                        <CommandItem disabled>
                          No indexed items yet.
                        </CommandItem>
                      )}
                    </CommandGroup>

                    {pathname.startsWith('/dashboards/') && (
                      <>
                        <CommandSeparator />
                        <CommandGroup heading="Navigation">
                          <CommandItem onSelect={() => goTo('/dashboards')}>
                            Back to dashboards
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}

                    {currentDashboardSlug && activePageId && (
                      <>
                        <CommandSeparator />
                        <CommandGroup heading="Widget Actions">
                          {availableWidgets.map((entry) => (
                            <CommandItem
                              key={`add-widget-${entry.definition.type}`}
                              onSelect={() =>
                                void handleAddWidget(
                                  entry.definition.type,
                                  entry.definition.defaultSize,
                                  entry.definition.defaultConfig,
                                )
                              }
                              value={`add widget ${entry.definition.displayName} ${entry.definition.type}`}
                            >
                              Add widget: {entry.definition.displayName}
                            </CommandItem>
                          ))}

                          {currentPageWidgets.map((widget) => (
                            <CommandItem
                              key={`remove-widget-${widget.id}`}
                              onSelect={() =>
                                void handleDeleteWidget(widget.id)
                              }
                              value={`remove widget ${widget.widgetTitle ?? widget.widgetType} ${widget.id}`}
                            >
                              Remove widget:{' '}
                              {widget.widgetTitle ?? widget.widgetType}
                            </CommandItem>
                          ))}

                          {currentPageWidgets.map((widget) => (
                            <CommandItem
                              key={`duplicate-widget-${widget.id}`}
                              onSelect={() =>
                                void handleDuplicateWidget(widget.id)
                              }
                              value={`duplicate widget ${widget.widgetTitle ?? widget.widgetType} ${widget.id}`}
                            >
                              Duplicate widget:{' '}
                              {widget.widgetTitle ?? widget.widgetType}
                            </CommandItem>
                          ))}

                          {currentPageWidgets
                            .filter(
                              (widget) => typeof widget.widgetType === 'string',
                            )
                            .map((widget) => (
                              <CommandItem
                                key={`configure-widget-${widget.id}`}
                                onSelect={() =>
                                  void handleResetWidgetConfig(
                                    widget.id,
                                    widget.widgetType as string,
                                  )
                                }
                                value={`configure widget reset ${widget.widgetTitle ?? widget.widgetType} ${widget.id}`}
                              >
                                Configure widget: Reset{' '}
                                {widget.widgetTitle ?? widget.widgetType}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </>
                    )}

                    <CommandSeparator />
                    <CommandGroup heading="Session">
                      <CommandItem onSelect={() => void handleLogout()}>
                        Sign out
                        <CommandShortcut>⇧ ⌘ Q</CommandShortcut>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      <button
        type="button"
        className="sr-only"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        Open command palette
      </button>
    </>
  )
}
