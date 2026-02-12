/**
 * Dashboard View Page
 *
 * Displays a single dashboard with page tabs and widget content.
 * Route: /dashboards/:slug
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { getDashboardFn } from '@server/api/dashboards'
import {
  addPageFn,
  deletePageFn,
  renamePageFn,
  reorderPagesFn,
} from '@server/api/pages'
import {
  addWidgetFn,
  deleteWidgetFn,
  duplicateWidgetFn,
  updateWidgetConfigFn,
  updateWidgetPositionsFn,
} from '@server/api/widgets'
import type { DashboardDetail } from '@server/api/dashboards'
import type { RealtimeServerMessage } from '@shared/contracts'
import type { ApiResponse } from '@shared/types'

import { getWidgetDefinition, WidgetRenderer } from '@/app/widgets'
import { PageTabs } from '@/components/dashboard/page-tabs'
import { VersionHistory } from '@/components/dashboard/version-history'
import { WidgetConfigForm } from '@/components/dashboard/widget-config-form'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPicker } from '@/components/dashboard/widget-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionHistory } from '@/hooks/use-action-history'
import { useEditMode } from '@/hooks/use-edit-mode'
import { useOptimisticMutations } from '@/hooks/use-optimistic-mutations'

export const Route = createFileRoute('/_authed/dashboards/$slug')({
  validateSearch: z.object({
    page: z.string().optional(),
  }),
  component: DashboardViewPage,
})

interface PageSummary {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  widgetCount: number
}

interface WidgetData {
  id: string
  type: string
  title: string | null
  config: Record<string, unknown>
  x: number
  y: number
  w: number
  h: number
}

interface PageWithWidgets extends PageSummary {
  widgets: Array<WidgetData>
}

type WidgetPositionUpdate = {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface WidgetMutationData extends WidgetData {
  pageId: string
}

const GRID_COLUMNS = 12
const EDIT_HISTORY_LIMIT = 120

interface ConfigSnapshot {
  pageId: string
  widgetId: string
  config: Record<string, unknown>
}

interface LayoutSnapshot {
  pageId: string
  positions: Array<WidgetPositionUpdate>
}

type DashboardEditAction =
  | {
      id: string
      timestamp: number
      kind: 'widget-config'
      description: string
      before: ConfigSnapshot
      after: ConfigSnapshot
    }
  | {
      id: string
      timestamp: number
      kind: 'widget-layout'
      description: string
      before: LayoutSnapshot
      after: LayoutSnapshot
    }

function createEditActionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(config)
}

function clonePositions(
  positions: Array<WidgetPositionUpdate>,
): Array<WidgetPositionUpdate> {
  return positions.map((position) => ({ ...position }))
}

function normalizePositions(
  positions: Array<WidgetPositionUpdate>,
): Array<WidgetPositionUpdate> {
  return [...positions].sort((a, b) => a.id.localeCompare(b.id))
}

function positionsEqual(
  left: Array<WidgetPositionUpdate>,
  right: Array<WidgetPositionUpdate>,
): boolean {
  if (left.length !== right.length) {
    return false
  }

  const normalizedLeft = normalizePositions(left)
  const normalizedRight = normalizePositions(right)

  for (let i = 0; i < normalizedLeft.length; i += 1) {
    const l = normalizedLeft[i]
    const r = normalizedRight[i]

    if (
      l.id !== r.id ||
      l.x !== r.x ||
      l.y !== r.y ||
      l.w !== r.w ||
      l.h !== r.h
    ) {
      return false
    }
  }

  return true
}

function buildPagePositions(
  page: PageWithWidgets,
): Array<WidgetPositionUpdate> {
  return page.widgets.map((widget) => ({
    id: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
  }))
}

function configsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function asApiResponse<T>(value: unknown): ApiResponse<T> {
  return value as ApiResponse<T>
}

type DashboardRealtimeBroadcast = Extract<
  RealtimeServerMessage,
  { type: 'broadcast' }
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRealtimeMessage(message: string): RealtimeServerMessage | null {
  try {
    const parsed = JSON.parse(message) as unknown
    if (!isRecord(parsed) || typeof parsed.type !== 'string') {
      return null
    }

    return parsed as RealtimeServerMessage
  } catch {
    return null
  }
}

type WidgetMutationSnapshot = ConfigSnapshot | LayoutSnapshot

function DashboardViewPage() {
  const { slug } = Route.useParams()
  const { page: requestedPageId } = Route.useSearch()
  const navigate = useNavigate()

  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null)
  const [pages, setPages] = useState<Array<PageWithWidgets>>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddPageDialog, setShowAddPageDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)

  const [newPageName, setNewPageName] = useState('')
  const [pageToEdit, setPageToEdit] = useState<PageWithWidgets | null>(null)
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pagesRef = useRef<Array<PageWithWidgets>>([])
  const configUpdateTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map())
  const pendingConfigUpdatesRef = useRef<Map<string, Record<string, unknown>>>(
    new Map(),
  )
  const activePageIdRef = useRef<string | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const realtimeClientIdRef = useRef<string | null>(null)
  const refetchDashboardRef = useRef<(() => Promise<void>) | null>(null)
  const rollbackConfigSnapshotRef = useRef<
    ((snapshot: ConfigSnapshot) => Promise<void>) | null
  >(null)
  const rollbackLayoutSnapshotRef = useRef<
    ((snapshot: LayoutSnapshot) => Promise<void>) | null
  >(null)

  const {
    canUndo,
    canRedo,
    isApplying: isApplyingHistory,
    undoActions,
    redoActions,
    push: pushHistoryAction,
    undo: undoHistory,
    redo: redoHistory,
    clear: clearHistory,
  } = useActionHistory<DashboardEditAction>({
    limit: EDIT_HISTORY_LIMIT,
  })

  const { isEditMode, enterEditMode, exitEditMode, toggleEditMode } =
    useEditMode({
      onExitEditMode: () => setSelectedWidgetId(null),
      enableEscapeToExit: false,
    })

  const optimisticMutations = useOptimisticMutations<WidgetMutationSnapshot>({
    onRollback: async (snapshot) => {
      if ('config' in snapshot && rollbackConfigSnapshotRef.current) {
        await rollbackConfigSnapshotRef.current(snapshot)
      } else if ('positions' in snapshot && rollbackLayoutSnapshotRef.current) {
        await rollbackLayoutSnapshotRef.current(snapshot)
      }
    },
    onError: (_mutationId, err) => {
      setError(`Mutation failed: ${err.message}`)
    },
  })

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [activePageId, pages],
  )

  const selectedWidget = useMemo(
    () =>
      activePage?.widgets.find((widget) => widget.id === selectedWidgetId) ??
      null,
    [activePage, selectedWidgetId],
  )

  const selectedWidgetDefinition = useMemo(
    () =>
      selectedWidget
        ? (getWidgetDefinition(selectedWidget.type) ?? null)
        : null,
    [selectedWidget],
  )

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useEffect(() => {
    activePageIdRef.current = activePageId
  }, [activePageId])

  useEffect(() => {
    clearHistory()
    setSelectedWidgetId(null)
  }, [activePageId, clearHistory, dashboard?.id])

  useEffect(
    () => () => {
      websocketRef.current?.close(1000, 'Dashboard view unmounted')
      websocketRef.current = null
      for (const timer of configUpdateTimersRef.current.values()) {
        clearTimeout(timer)
      }
      configUpdateTimersRef.current.clear()
      pendingConfigUpdatesRef.current.clear()
    },
    [],
  )

  const applyRealtimeBroadcast = useCallback(
    (message: DashboardRealtimeBroadcast) => {
      if (!dashboard || message.dashboardId !== dashboard.id) {
        return
      }

      const currentClientId = realtimeClientIdRef.current
      if (currentClientId && message.actorId === currentClientId) {
        return
      }

      if (message.event === 'layout:change') {
        const payload = message.payload
        const pageId =
          typeof payload.pageId === 'string' ? payload.pageId : null
        const positions = Array.isArray(payload.positions)
          ? payload.positions
          : null

        if (!pageId || !positions) {
          return
        }

        const positionMap = new Map<string, WidgetPositionUpdate>()

        for (const candidate of positions) {
          if (!isRecord(candidate) || typeof candidate.id !== 'string') {
            continue
          }

          const { id, x, y, w, h } = candidate
          if (
            typeof x !== 'number' ||
            typeof y !== 'number' ||
            typeof w !== 'number' ||
            typeof h !== 'number'
          ) {
            continue
          }

          positionMap.set(id, {
            id,
            x,
            y,
            w,
            h,
          })
        }

        if (positionMap.size === 0) {
          return
        }

        setPages((prev) =>
          prev.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  widgets: page.widgets.map((widget) => {
                    const nextPosition = positionMap.get(widget.id)
                    if (!nextPosition) {
                      return widget
                    }

                    return {
                      ...widget,
                      x: nextPosition.x,
                      y: nextPosition.y,
                      w: nextPosition.w,
                      h: nextPosition.h,
                    }
                  }),
                }
              : page,
          ),
        )

        return
      }

      if (message.event !== 'widget:update') {
        return
      }

      const payload = message.payload
      const action = typeof payload.action === 'string' ? payload.action : null
      const pageId = typeof payload.pageId === 'string' ? payload.pageId : null

      if (!action || !pageId) {
        return
      }

      if (action === 'deleted') {
        const widgetId =
          typeof payload.widgetId === 'string' ? payload.widgetId : null
        if (!widgetId) {
          return
        }

        setPages((prev) =>
          prev.map((page) => {
            if (page.id !== pageId) {
              return page
            }

            const hasWidget = page.widgets.some(
              (widget) => widget.id === widgetId,
            )
            if (!hasWidget) {
              return page
            }

            return {
              ...page,
              widgetCount: Math.max(0, page.widgetCount - 1),
              widgets: page.widgets.filter((widget) => widget.id !== widgetId),
            }
          }),
        )

        return
      }

      if (action === 'updated') {
        const widgetId =
          typeof payload.widgetId === 'string' ? payload.widgetId : null
        const patch = isRecord(payload.patch) ? payload.patch : null

        if (!widgetId || !patch) {
          return
        }

        setPages((prev) =>
          prev.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  widgets: page.widgets.map((widget) => {
                    if (widget.id !== widgetId) {
                      return widget
                    }

                    const config =
                      'config' in patch && isRecord(patch.config)
                        ? patch.config
                        : widget.config

                    const title =
                      'title' in patch &&
                      (typeof patch.title === 'string' || patch.title === null)
                        ? patch.title
                        : widget.title

                    return {
                      ...widget,
                      title,
                      config,
                    }
                  }),
                }
              : page,
          ),
        )

        return
      }

      if (action === 'created') {
        const nextWidget = isRecord(payload.widget) ? payload.widget : null
        if (!nextWidget || typeof nextWidget.id !== 'string') {
          return
        }

        if (
          typeof nextWidget.type !== 'string' ||
          (typeof nextWidget.title !== 'string' && nextWidget.title !== null) ||
          !isRecord(nextWidget.config) ||
          typeof nextWidget.x !== 'number' ||
          typeof nextWidget.y !== 'number' ||
          typeof nextWidget.w !== 'number' ||
          typeof nextWidget.h !== 'number'
        ) {
          return
        }

        const nextWidgetData: WidgetData = {
          id: nextWidget.id,
          type: nextWidget.type,
          title: nextWidget.title,
          config: nextWidget.config,
          x: nextWidget.x,
          y: nextWidget.y,
          w: nextWidget.w,
          h: nextWidget.h,
        }

        setPages((prev) =>
          prev.map((page) => {
            if (page.id !== pageId) {
              return page
            }

            const exists = page.widgets.some(
              (widget) => widget.id === nextWidgetData.id,
            )
            if (exists) {
              return page
            }

            return {
              ...page,
              widgetCount: page.widgetCount + 1,
              widgets: [...page.widgets, nextWidgetData],
            }
          }),
        )
      }
    },
    [dashboard],
  )

  useEffect(() => {
    if (!dashboard || typeof window === 'undefined') {
      return
    }

    const BASE_RECONNECT_DELAY_MS = 400
    const MAX_RECONNECT_DELAY_MS = 10_000

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const endpoint = `${scheme}//${window.location.host}/_ws`

    let isDisposed = false
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let hasConnectedAtLeastOnce = false

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (isDisposed) {
        return
      }

      const exponentialDelay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts,
      )
      const jitter = Math.floor(Math.random() * 200)
      const delay = exponentialDelay + jitter

      reconnectAttempts += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    const connect = () => {
      if (isDisposed) {
        return
      }

      const socket = new WebSocket(endpoint)
      websocketRef.current = socket

      socket.onopen = () => {
        reconnectAttempts = 0
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return
        }

        const parsed = parseRealtimeMessage(event.data)
        if (!parsed) {
          return
        }

        if (parsed.type === 'hello') {
          const isReconnect = hasConnectedAtLeastOnce
          hasConnectedAtLeastOnce = true

          realtimeClientIdRef.current = parsed.clientId
          socket.send(
            JSON.stringify({
              type: 'subscribe',
              dashboardId: dashboard.id,
            }),
          )

          if (isReconnect) {
            void refetchDashboardRef.current?.()
          }

          return
        }

        if (parsed.type === 'broadcast') {
          applyRealtimeBroadcast(parsed)
        }
      }

      socket.onclose = () => {
        if (websocketRef.current === socket) {
          websocketRef.current = null
        }

        if (isDisposed) {
          return
        }

        scheduleReconnect()
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      isDisposed = true
      clearReconnectTimer()

      const socket = websocketRef.current
      websocketRef.current = null

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'unsubscribe',
            dashboardId: dashboard.id,
          }),
        )
      }

      socket?.close(1000, 'Dashboard changed')
    }
  }, [applyRealtimeBroadcast, dashboard])

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = asApiResponse<DashboardDetail>(
        await getDashboardFn({
          data: { identifier: slug, includeWidgets: true },
        }),
      )

      if (result.success && result.data) {
        setDashboard(result.data)
        const pagesWithWidgets: Array<PageWithWidgets> = result.data.pages.map(
          (p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            sortOrder: p.sortOrder,
            widgetCount: p.widgetCount,
            widgets:
              p.widgets?.map((w) => ({
                id: w.id,
                type: w.type,
                title: w.title,
                config: w.config,
                x: w.x,
                y: w.y,
                w: w.w,
                h: w.h,
              })) ?? [],
          }),
        )
        setPages(pagesWithWidgets)

        const hasRequestedPage =
          requestedPageId !== undefined &&
          pagesWithWidgets.some((p) => p.id === requestedPageId)
        const hasPreviousPage =
          activePageId !== null &&
          pagesWithWidgets.some((p) => p.id === activePageId)

        const nextActivePageId = hasRequestedPage
          ? requestedPageId
          : hasPreviousPage
            ? activePageId
            : (pagesWithWidgets[0]?.id ?? null)

        setActivePageId(nextActivePageId)

        if (nextActivePageId !== requestedPageId) {
          void navigate({
            to: '/dashboards/$slug',
            params: { slug },
            search: nextActivePageId ? { page: nextActivePageId } : {},
            replace: true,
          })
        }
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [slug, activePageId, requestedPageId, navigate])

  useEffect(() => {
    refetchDashboardRef.current = fetchDashboard
  }, [fetchDashboard])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const handlePageSelect = useCallback(
    (pageId: string) => {
      setActivePageId(pageId)
      setSelectedWidgetId(null)
      void navigate({
        to: '/dashboards/$slug',
        params: { slug },
        search: { page: pageId },
      })
    },
    [navigate, slug],
  )

  async function handleAddPage(e: React.FormEvent) {
    e.preventDefault()
    if (!dashboard || !newPageName.trim()) return

    setIsSubmitting(true)

    try {
      const result = asApiResponse<PageSummary>(
        await addPageFn({
          data: {
            dashboardId: dashboard.id,
            name: newPageName.trim(),
          },
        }),
      )

      if (result.success && result.data) {
        const newPage: PageWithWidgets = {
          id: result.data.id,
          name: result.data.name,
          icon: result.data.icon,
          sortOrder: result.data.sortOrder,
          widgetCount: result.data.widgetCount,
          widgets: [],
        }
        setPages((prev) => [...prev, newPage])
        setActivePageId(newPage.id)
        setSelectedWidgetId(null)
        void navigate({
          to: '/dashboards/$slug',
          params: { slug },
          search: { page: newPage.id },
        })
        setShowAddPageDialog(false)
        setNewPageName('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to add page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRenamePage(e: React.FormEvent) {
    e.preventDefault()
    if (!pageToEdit || !newPageName.trim()) return

    setIsSubmitting(true)

    try {
      const result = asApiResponse<PageSummary>(
        await renamePageFn({
          data: {
            id: pageToEdit.id,
            name: newPageName.trim(),
          },
        }),
      )

      if (result.success && result.data) {
        setPages((prev) =>
          prev.map((p) =>
            p.id === pageToEdit.id ? { ...p, name: result.data!.name } : p,
          ),
        )
        setShowRenameDialog(false)
        setPageToEdit(null)
        setNewPageName('')
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to rename page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeletePage() {
    if (!pageToEdit) return

    setIsSubmitting(true)

    try {
      const result = asApiResponse<{ deleted: boolean }>(
        await deletePageFn({ data: { id: pageToEdit.id } }),
      )

      if (result.success) {
        const remaining = pages.filter((p) => p.id !== pageToEdit.id)
        setPages(remaining)
        if (activePageId === pageToEdit.id) {
          const nextPageId = remaining[0]?.id ?? null
          setActivePageId(nextPageId)
          setSelectedWidgetId(null)
          void navigate({
            to: '/dashboards/$slug',
            params: { slug },
            search: nextPageId ? { page: nextPageId } : {},
          })
        }
        setShowDeleteDialog(false)
        setPageToEdit(null)
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to delete page')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReorderPages(newOrder: Array<{ id: string }>) {
    if (!dashboard) return

    const pageIds = newOrder.map((p) => p.id)

    try {
      const result = asApiResponse<{ updated: number }>(
        await reorderPagesFn({
          data: {
            dashboardId: dashboard.id,
            pageIds,
          },
        }),
      )

      if (result.success) {
        setPages((prev) => {
          const orderMap = new Map(pageIds.map((id, i) => [id, i]))
          return [...prev].sort(
            (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
          )
        })
      } else if (result.error) {
        setError(result.error.message)
      }
    } catch {
      setError('Failed to reorder pages')
    }
  }

  const persistWidgetConfig = useCallback(
    async (
      widgetId: string,
      config: Record<string, unknown>,
      mutationId?: string,
    ) => {
      const currentPage = pagesRef.current.find(
        (page) => page.id === activePageIdRef.current,
      )
      const currentWidget = currentPage?.widgets.find(
        (widget) => widget.id === widgetId,
      )

      if (!currentWidget) {
        if (mutationId) {
          optimisticMutations.failMutation(mutationId, 'Widget not found')
        }
        return
      }

      const definition = getWidgetDefinition(currentWidget.type)
      if (definition) {
        const validation = definition.configSchema.safeParse({
          ...definition.defaultConfig,
          ...config,
        })

        if (!validation.success) {
          if (mutationId) {
            optimisticMutations.failMutation(
              mutationId,
              'Invalid widget configuration',
            )
          }
          setError('Invalid widget configuration. Please review your values.')
          return
        }
      }

      const result = asApiResponse<WidgetMutationData>(
        await updateWidgetConfigFn({
          data: {
            id: widgetId,
            config,
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
            mutationTimestamp: Date.now(),
          },
        }),
      )

      if (!result.success) {
        if (mutationId) {
          optimisticMutations.failMutation(
            mutationId,
            result.error?.message ?? 'Failed to save',
          )
        } else if (result.error) {
          setError(result.error.message)
        }
        return
      }

      if (mutationId) {
        optimisticMutations.confirmMutation(mutationId)
      }
    },
    [fetchDashboard, optimisticMutations],
  )

  const queueWidgetConfigPersist = useCallback(
    (widgetId: string, fullConfig: Record<string, unknown>) => {
      pendingConfigUpdatesRef.current.set(widgetId, cloneConfig(fullConfig))

      const existingTimer = configUpdateTimersRef.current.get(widgetId)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      const timer = setTimeout(() => {
        const finalConfig = pendingConfigUpdatesRef.current.get(widgetId)
        pendingConfigUpdatesRef.current.delete(widgetId)
        configUpdateTimersRef.current.delete(widgetId)

        if (finalConfig) {
          void persistWidgetConfig(widgetId, finalConfig)
        }
      }, 450)

      configUpdateTimersRef.current.set(widgetId, timer)
    },
    [persistWidgetConfig],
  )

  const applyWidgetConfigSnapshot = useCallback(
    async (snapshot: ConfigSnapshot) => {
      setPages((prev) =>
        prev.map((page) =>
          page.id === snapshot.pageId
            ? {
                ...page,
                widgets: page.widgets.map((widget) =>
                  widget.id === snapshot.widgetId
                    ? { ...widget, config: cloneConfig(snapshot.config) }
                    : widget,
                ),
              }
            : page,
        ),
      )

      const existingTimer = configUpdateTimersRef.current.get(snapshot.widgetId)
      if (existingTimer) {
        clearTimeout(existingTimer)
        configUpdateTimersRef.current.delete(snapshot.widgetId)
      }

      pendingConfigUpdatesRef.current.delete(snapshot.widgetId)
      await persistWidgetConfig(snapshot.widgetId, cloneConfig(snapshot.config))
    },
    [persistWidgetConfig],
  )

  const applyWidgetLayoutSnapshot = useCallback(
    async (snapshot: LayoutSnapshot) => {
      const positionMap = new Map(
        snapshot.positions.map((position) => [position.id, position]),
      )

      setPages((prev) =>
        prev.map((page) =>
          page.id === snapshot.pageId
            ? {
                ...page,
                widgets: page.widgets.map((widget) => {
                  const nextPosition = positionMap.get(widget.id)
                  if (!nextPosition) {
                    return widget
                  }

                  return {
                    ...widget,
                    x: nextPosition.x,
                    y: nextPosition.y,
                    w: nextPosition.w,
                    h: nextPosition.h,
                  }
                }),
              }
            : page,
        ),
      )

      const result = asApiResponse<{ updated: number }>(
        await updateWidgetPositionsFn({
          data: {
            positions: clonePositions(snapshot.positions),
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
            mutationTimestamp: Date.now(),
          },
        }),
      )

      if (!result.success && result.error) {
        setError(result.error.message)
        throw new Error(result.error.message)
      }
    },
    [],
  )

  useEffect(() => {
    rollbackConfigSnapshotRef.current = applyWidgetConfigSnapshot
  }, [applyWidgetConfigSnapshot])

  useEffect(() => {
    rollbackLayoutSnapshotRef.current = applyWidgetLayoutSnapshot
  }, [applyWidgetLayoutSnapshot])

  const handleWidgetSelect = useCallback(
    (widgetId: string) => {
      setSelectedWidgetId(widgetId)
      if (!isEditMode) {
        enterEditMode()
      }
    },
    [enterEditMode, isEditMode],
  )

  const handleWidgetConfigure = useCallback(
    (widgetId: string) => {
      if (!isEditMode) {
        enterEditMode()
      }
      setSelectedWidgetId(widgetId)
    },
    [enterEditMode, isEditMode],
  )

  const handleWidgetConfigChange = useCallback(
    (widgetId: string, patch: Record<string, unknown>) => {
      if (!activePageId) {
        return
      }

      const currentPage = pagesRef.current.find(
        (page) => page.id === activePageId,
      )
      const currentWidget = currentPage?.widgets.find(
        (widget) => widget.id === widgetId,
      )

      if (!currentWidget) {
        return
      }

      const beforeConfig = cloneConfig(currentWidget.config)
      const nextConfig = {
        ...beforeConfig,
        ...patch,
      }

      if (configsEqual(beforeConfig, nextConfig)) {
        return
      }

      setPages((prev) =>
        prev.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                widgets: page.widgets.map((widget) =>
                  widget.id === widgetId
                    ? {
                        ...widget,
                        config: cloneConfig(nextConfig),
                      }
                    : widget,
                ),
              }
            : page,
        ),
      )

      queueWidgetConfigPersist(widgetId, nextConfig)

      if (!isApplyingHistory) {
        const now = Date.now()
        pushHistoryAction({
          id: createEditActionId(),
          timestamp: now,
          kind: 'widget-config',
          description: `Updated ${currentWidget.title ?? currentWidget.type} settings`,
          before: {
            pageId: activePageId,
            widgetId,
            config: beforeConfig,
          },
          after: {
            pageId: activePageId,
            widgetId,
            config: cloneConfig(nextConfig),
          },
        })
      }
    },
    [
      activePageId,
      isApplyingHistory,
      pushHistoryAction,
      queueWidgetConfigPersist,
    ],
  )

  const handleWidgetLayoutChange = useCallback(
    async (positions: Array<WidgetPositionUpdate>) => {
      if (!activePageId) {
        return
      }

      const currentPage = pagesRef.current.find(
        (page) => page.id === activePageId,
      )
      if (!currentPage) {
        return
      }

      const beforePositions = buildPagePositions(currentPage)
      if (positionsEqual(beforePositions, positions)) {
        return
      }

      const positionMap = new Map(
        positions.map((position) => [position.id, position]),
      )

      const mutationId = optimisticMutations.startMutation('widget-layout', {
        pageId: activePageId,
        positions: clonePositions(beforePositions),
      })

      setPages((prev) =>
        prev.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                widgets: page.widgets.map((widget) => {
                  const nextPosition = positionMap.get(widget.id)
                  if (!nextPosition) {
                    return widget
                  }

                  return {
                    ...widget,
                    x: nextPosition.x,
                    y: nextPosition.y,
                    w: nextPosition.w,
                    h: nextPosition.h,
                  }
                }),
              }
            : page,
        ),
      )

      const result = asApiResponse<{ updated: number }>(
        await updateWidgetPositionsFn({
          data: {
            positions,
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
            mutationTimestamp: Date.now(),
          },
        }),
      )

      if (!result.success) {
        optimisticMutations.failMutation(
          mutationId,
          result.error?.message ?? 'Failed to update layout',
        )

        if (result.error) {
          setError(result.error.message)
        }
        return
      }

      optimisticMutations.confirmMutation(mutationId)

      if (!isApplyingHistory) {
        const now = Date.now()
        pushHistoryAction({
          id: createEditActionId(),
          timestamp: now,
          kind: 'widget-layout',
          description: 'Moved or resized widget(s)',
          before: {
            pageId: activePageId,
            positions: clonePositions(beforePositions),
          },
          after: {
            pageId: activePageId,
            positions: clonePositions(positions),
          },
        })
      }
    },
    [
      activePageId,
      fetchDashboard,
      isApplyingHistory,
      pushHistoryAction,
      optimisticMutations,
    ],
  )

  const handleAddWidget = useCallback(
    async (widgetType: string, defaultSize: { w: number; h: number }) => {
      if (!activePageId) {
        return
      }

      const definition = getWidgetDefinition(widgetType)
      if (!definition) {
        setError(`Widget type "${widgetType}" is not registered.`)
        return
      }

      const targetPage = pagesRef.current.find(
        (page) => page.id === activePageId,
      )
      const nextY =
        targetPage?.widgets.reduce(
          (maxY, widget) => Math.max(maxY, widget.y + widget.h),
          0,
        ) ?? 0

      const result = asApiResponse<WidgetMutationData>(
        await addWidgetFn({
          data: {
            pageId: activePageId,
            type: widgetType,
            w: defaultSize.w,
            h: defaultSize.h,
            x: 0,
            y: nextY,
            config: definition.defaultConfig,
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
          },
        }),
      )

      if (!result.success || !result.data) {
        setError(result.error?.message ?? 'Failed to add widget')
        return
      }

      const createdWidget = result.data

      setPages((prev) =>
        prev.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                widgetCount: page.widgetCount + 1,
                widgets: [
                  ...page.widgets,
                  {
                    id: createdWidget.id,
                    type: createdWidget.type,
                    title: createdWidget.title,
                    config: createdWidget.config,
                    x: createdWidget.x,
                    y: createdWidget.y,
                    w: createdWidget.w,
                    h: createdWidget.h,
                  },
                ],
              }
            : page,
        ),
      )

      setSelectedWidgetId(createdWidget.id)
      setShowWidgetPicker(false)
      if (!isEditMode) {
        enterEditMode()
      }
    },
    [activePageId, enterEditMode, isEditMode],
  )

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      if (
        !window.confirm('Delete this widget? This action cannot be undone.')
      ) {
        return
      }

      const result = asApiResponse<{ deleted: boolean }>(
        await deleteWidgetFn({
          data: {
            id: widgetId,
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
          },
        }),
      )

      if (!result.success) {
        setError(result.error?.message ?? 'Failed to delete widget')
        return
      }

      setPages((prev) =>
        prev.map((page) => {
          const hadWidget = page.widgets.some(
            (widget) => widget.id === widgetId,
          )
          if (!hadWidget) {
            return page
          }

          return {
            ...page,
            widgetCount: Math.max(0, page.widgetCount - 1),
            widgets: page.widgets.filter((widget) => widget.id !== widgetId),
          }
        }),
      )

      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(null)
      }
    },
    [selectedWidgetId],
  )

  const handleDuplicateWidget = useCallback(
    async (widgetId: string) => {
      const result = asApiResponse<WidgetMutationData>(
        await duplicateWidgetFn({
          data: {
            id: widgetId,
            offsetX: 1,
            offsetY: 1,
            realtimeClientId: realtimeClientIdRef.current ?? undefined,
          },
        }),
      )

      if (!result.success || !result.data) {
        setError(result.error?.message ?? 'Failed to duplicate widget')
        return
      }

      const duplicatedWidget = result.data

      setPages((prev) =>
        prev.map((page) =>
          page.id === duplicatedWidget.pageId
            ? {
                ...page,
                widgetCount: page.widgetCount + 1,
                widgets: [
                  ...page.widgets,
                  {
                    id: duplicatedWidget.id,
                    type: duplicatedWidget.type,
                    title: duplicatedWidget.title,
                    config: duplicatedWidget.config,
                    x: duplicatedWidget.x,
                    y: duplicatedWidget.y,
                    w: duplicatedWidget.w,
                    h: duplicatedWidget.h,
                  },
                ],
              }
            : page,
        ),
      )

      setSelectedWidgetId(duplicatedWidget.id)
      if (!isEditMode) {
        enterEditMode()
      }
    },
    [enterEditMode, isEditMode],
  )

  const moveSelectedWidget = useCallback(
    async (deltaX: number, deltaY: number) => {
      if (!activePage || !selectedWidgetId) {
        return
      }

      const widget = activePage.widgets.find((w) => w.id === selectedWidgetId)
      if (!widget) {
        return
      }

      const maxX = Math.max(0, GRID_COLUMNS - widget.w)
      const nextX = Math.min(maxX, Math.max(0, widget.x + deltaX))
      const nextY = Math.max(0, widget.y + deltaY)

      if (nextX === widget.x && nextY === widget.y) {
        return
      }

      await handleWidgetLayoutChange([
        {
          id: widget.id,
          x: nextX,
          y: nextY,
          w: widget.w,
          h: widget.h,
        },
      ])
    },
    [activePage, handleWidgetLayoutChange, selectedWidgetId],
  )

  const applyHistoryInverse = useCallback(
    async (action: DashboardEditAction) => {
      if (action.kind === 'widget-config') {
        await applyWidgetConfigSnapshot(action.before)
        return
      }

      await applyWidgetLayoutSnapshot(action.before)
    },
    [applyWidgetConfigSnapshot, applyWidgetLayoutSnapshot],
  )

  const applyHistoryForward = useCallback(
    async (action: DashboardEditAction) => {
      if (action.kind === 'widget-config') {
        await applyWidgetConfigSnapshot(action.after)
        return
      }

      await applyWidgetLayoutSnapshot(action.after)
    },
    [applyWidgetConfigSnapshot, applyWidgetLayoutSnapshot],
  )

  const handleUndo = useCallback(async () => {
    const didUndo = await undoHistory(applyHistoryInverse)
    if (!didUndo) {
      return
    }

    setError(null)
  }, [applyHistoryInverse, undoHistory])

  const handleRedo = useCallback(async () => {
    const didRedo = await redoHistory(applyHistoryForward)
    if (!didRedo) {
      return
    }

    setError(null)
  }, [applyHistoryForward, redoHistory])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      if (!element) {
        return false
      }

      const tagName = element.tagName.toLowerCase()
      return (
        element.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditMode) {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      const isUndoKey =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'z'

      if (isUndoKey) {
        event.preventDefault()

        if (event.shiftKey) {
          void handleRedo()
        } else {
          void handleUndo()
        }

        return
      }

      if (event.key === 'Escape') {
        if (selectedWidgetId) {
          event.preventDefault()
          setSelectedWidgetId(null)
        }
        return
      }

      if (!selectedWidgetId) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        void handleDeleteWidget(selectedWidgetId)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        void handleDuplicateWidget(selectedWidgetId)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        void moveSelectedWidget(-1, 0)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        void moveSelectedWidget(1, 0)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        void moveSelectedWidget(0, -1)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        void moveSelectedWidget(0, 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleDeleteWidget,
    handleDuplicateWidget,
    handleRedo,
    handleUndo,
    isEditMode,
    moveSelectedWidget,
    selectedWidgetId,
  ])

  function openRenameDialog(page: { id: string; name: string }) {
    const fullPage = pages.find((p) => p.id === page.id)
    if (fullPage) {
      setPageToEdit(fullPage)
      setNewPageName(fullPage.name)
      setShowRenameDialog(true)
    }
  }

  function openDeleteDialog(page: { id: string }) {
    const fullPage = pages.find((p) => p.id === page.id)
    if (fullPage) {
      setPageToEdit(fullPage)
      setShowDeleteDialog(true)
    }
  }

  const recentEdits = useMemo(
    () => [...undoActions].slice(-8).reverse(),
    [undoActions],
  )

  const undoneEdits = useMemo(
    () => [...redoActions].slice(-5).reverse(),
    [redoActions],
  )

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground space-y-4">
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
        <p>Loading dashboard...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
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
            Dashboard not found
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {error ??
              'This dashboard does not exist or you do not have access to it.'}
          </p>
        </div>
        <Link to="/dashboards" className={buttonVariants()}>
          Go to Dashboards
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))]">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 -mr-2"
              onClick={() => setError(null)}
            >
              <span className="sr-only">Dismiss</span>×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {Array.from(optimisticMutations.pendingMutations.values())
        .filter((m) => m.status === 'failed')
        .map((failedMutation) => (
          <Alert key={failedMutation.id} variant="destructive" className="mb-2">
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{failedMutation.error ?? 'Mutation failed'}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void optimisticMutations.rollbackMutation(failedMutation.id)
                  }
                >
                  Rollback
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    optimisticMutations.clearMutation(failedMutation.id)
                  }
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ))}

      <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboards"
            className="shrink-0 rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Back to dashboards"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{dashboard.name}</h1>
            {dashboard.description && (
              <p className="text-sm text-muted-foreground truncate">
                {dashboard.description}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {dashboard.isPublic && (
              <Badge variant="outline" className="text-xs">
                Public
              </Badge>
            )}
            {dashboard.isDefault && (
              <Badge variant="secondary" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {optimisticMutations.hasPendingMutations && (
            <Badge variant="outline" className="text-xs animate-pulse">
              Saving...
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!isEditMode || !canUndo || isApplyingHistory}
            onClick={() => void handleUndo()}
            title="Undo (Ctrl/Cmd+Z)"
          >
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!isEditMode || !canRedo || isApplyingHistory}
            onClick={() => void handleRedo()}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            Redo
          </Button>
          <Button
            variant={isEditMode ? 'glass-primary' : 'outline'}
            size="sm"
            onClick={isEditMode ? exitEditMode : enterEditMode}
          >
            {isEditMode ? 'Done Editing' : 'Edit Widgets'}
          </Button>
          <Button
            variant="glass"
            size="sm"
            disabled={!activePage}
            onClick={() => setShowWidgetPicker(true)}
          >
            Add Widget
          </Button>
          <Link
            to="/dashboards/$slug/yaml"
            params={{ slug: dashboard.slug }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            YAML
          </Link>
          <VersionHistory
            dashboardId={dashboard.id}
            dashboardName={dashboard.name}
            onVersionRestored={fetchDashboard}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <span className="sr-only">Dashboard options</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Link
                  to="/dashboards/$slug/settings"
                  params={{ slug: dashboard.slug }}
                  className="flex items-center w-full"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <PageTabs
        pages={pages}
        activePageId={activePageId}
        onPageSelect={handlePageSelect}
        onAddPage={() => {
          setNewPageName('')
          setShowAddPageDialog(true)
        }}
        onRenamePage={openRenameDialog}
        onDeletePage={openDeleteDialog}
        onReorder={handleReorderPages}
      />

      <main className="flex-1 overflow-auto p-4">
        {activePage ? (
          <PageContent
            page={activePage}
            isEditMode={isEditMode}
            selectedWidgetId={selectedWidgetId}
            selectedWidget={selectedWidget}
            selectedWidgetDefinition={selectedWidgetDefinition}
            onToggleEditMode={toggleEditMode}
            onAddWidget={() => setShowWidgetPicker(true)}
            onWidgetSelect={handleWidgetSelect}
            onWidgetConfigure={handleWidgetConfigure}
            onWidgetDelete={handleDeleteWidget}
            onWidgetDuplicate={handleDuplicateWidget}
            onWidgetLayoutChange={handleWidgetLayoutChange}
            onWidgetConfigChange={handleWidgetConfigChange}
            recentEdits={recentEdits}
            undoneEdits={undoneEdits}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No page selected</p>
          </div>
        )}
      </main>

      <Dialog open={showWidgetPicker} onOpenChange={setShowWidgetPicker}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget to add to this page.
            </DialogDescription>
          </DialogHeader>
          <WidgetPicker
            onSelect={handleAddWidget}
            onClose={() => setShowWidgetPicker(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showAddPageDialog} onOpenChange={setShowAddPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Page</DialogTitle>
            <DialogDescription>
              Create a new page in this dashboard.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleAddPage}
            id="add-page-form"
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page Name</Label>
              <Input
                id="page-name"
                type="text"
                placeholder="New Page"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                maxLength={100}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddPageDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-page-form"
              disabled={isSubmitting || !newPageName.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Enter a new name for this page.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleRenamePage}
            id="rename-page-form"
            className="space-y-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="rename-page-name">Page Name</Label>
              <Input
                id="rename-page-name"
                type="text"
                placeholder="Page name"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                maxLength={100}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="rename-page-form"
              disabled={isSubmitting || !newPageName.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{pageToEdit?.name}"? All widgets
              on this page will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePage}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface PageContentProps {
  page: PageWithWidgets
  isEditMode: boolean
  selectedWidgetId: string | null
  selectedWidget: WidgetData | null
  selectedWidgetDefinition: ReturnType<typeof getWidgetDefinition> | null
  recentEdits: Array<DashboardEditAction>
  undoneEdits: Array<DashboardEditAction>
  onToggleEditMode: () => void
  onAddWidget: () => void
  onWidgetSelect: (widgetId: string) => void
  onWidgetConfigure: (widgetId: string) => void
  onWidgetDelete: (widgetId: string) => void
  onWidgetDuplicate: (widgetId: string) => void
  onWidgetLayoutChange: (positions: Array<WidgetPositionUpdate>) => void
  onWidgetConfigChange: (
    widgetId: string,
    patch: Record<string, unknown>,
  ) => void
}

function PageContent({
  page,
  isEditMode,
  selectedWidgetId,
  selectedWidget,
  selectedWidgetDefinition,
  recentEdits,
  undoneEdits,
  onToggleEditMode,
  onAddWidget,
  onWidgetSelect,
  onWidgetConfigure,
  onWidgetDelete,
  onWidgetDuplicate,
  onWidgetLayoutChange,
  onWidgetConfigChange,
}: PageContentProps) {
  if (page.widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-20">
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
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h7M14 17h7M14 20h4" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            No widgets yet
          </h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Add widgets to this page to start building your dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isEditMode ? 'glass-primary' : 'outline'}
            onClick={onToggleEditMode}
          >
            {isEditMode ? 'Done Editing' : 'Edit Widgets'}
          </Button>
          <Button onClick={onAddWidget}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Widget
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <WidgetGrid
          widgets={page.widgets.map((widget) => ({
            id: widget.id,
            type: widget.type,
            title: widget.title,
            config: widget.config,
            layout: {
              i: widget.id,
              x: widget.x,
              y: widget.y,
              w: widget.w,
              h: widget.h,
            },
          }))}
          isEditable={isEditMode}
          selectedWidgetId={selectedWidgetId}
          onWidgetSelect={onWidgetSelect}
          onWidgetConfigure={onWidgetConfigure}
          onWidgetDelete={onWidgetDelete}
          onWidgetDuplicate={onWidgetDuplicate}
          onLayoutChange={(layouts) => {
            const positions = layouts.map((layout) => ({
              id: layout.i,
              x: layout.x,
              y: layout.y,
              w: layout.w,
              h: layout.h,
            }))
            onWidgetLayoutChange(positions)
          }}
          renderWidgetContent={(widget) => {
            const pageWidget = page.widgets.find((w) => w.id === widget.id)
            if (!pageWidget) {
              return null
            }

            return (
              <WidgetRenderer
                widgetId={pageWidget.id}
                widgetType={pageWidget.type}
                config={pageWidget.config}
                isEditing={isEditMode}
                dimensions={{ w: pageWidget.w, h: pageWidget.h }}
                onConfigChange={(patch) =>
                  onWidgetConfigChange(
                    pageWidget.id,
                    patch as Record<string, unknown>,
                  )
                }
              />
            )
          }}
        />
      </div>

      <aside className="hidden lg:block">
        <GlassCard variant="heavy" className="h-full">
          <div className="flex h-full flex-col gap-4 p-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Widget editor</h2>
              <p className="text-xs text-muted-foreground">
                Click a widget to edit. Drag to move and use resize handles to
                adjust layout.
              </p>
            </div>

            <section className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Edit history
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {recentEdits.length} recent
                </span>
              </div>

              {recentEdits.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No edits recorded yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {recentEdits.map((action) => (
                    <li
                      key={action.id}
                      className="rounded-md border border-border/50 bg-background/70 px-2 py-1.5"
                    >
                      <p className="text-xs font-medium leading-tight">
                        {action.description}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {undoneEdits.length > 0 && (
                <div className="border-t border-border/60 pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    {undoneEdits.length} action(s) available to redo
                  </p>
                </div>
              )}
            </section>

            {isEditMode && selectedWidget && selectedWidgetDefinition ? (
              <WidgetConfigForm
                definition={selectedWidgetDefinition}
                config={{
                  ...selectedWidgetDefinition.defaultConfig,
                  ...selectedWidget.config,
                }}
                onChange={(patch) =>
                  onWidgetConfigChange(
                    selectedWidget.id,
                    patch as Record<string, unknown>,
                  )
                }
                className="h-full overflow-auto"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                {isEditMode
                  ? 'Select a widget to configure it inline.'
                  : 'Enable edit mode to move, resize, and configure widgets.'}
              </div>
            )}
          </div>
        </GlassCard>
      </aside>
    </div>
  )
}
