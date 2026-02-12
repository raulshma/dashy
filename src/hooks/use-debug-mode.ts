/**
 * Debug Mode Hook
 *
 * Provides debug mode functionality for dashboards.
 * Activated via ?debug=true URL parameter.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'

export interface WidgetDebugInfo {
  id: string
  type: string
  renderTime: number
  configSize: number
  lastUpdate: string | null
  isVisible: boolean
}

export interface DebugInfo {
  enabled: boolean
  widgets: Map<string, WidgetDebugInfo>
  wsConnected: boolean
  wsLatency: number | null
  realtimeClientId: string | null
  pageLoadTime: number
  memoryUsage: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null
}

interface DebugSearch {
  debug?: string
}

export function useDebugMode() {
  const search = useSearch({ strict: false }) as DebugSearch
  const enabled = search.debug === 'true'
  const pageLoadTime = useRef(performance.now())
  const [wsConnected, setWsConnected] = useState(false)
  const [wsLatency, setWsLatency] = useState<number | null>(null)
  const [realtimeClientId, setRealtimeClientId] = useState<string | null>(null)
  const widgetsRef = useRef(new Map<string, WidgetDebugInfo>())

  useEffect(() => {
    if (!enabled) return

    const handleWsMessage = (event: CustomEvent) => {
      const detail = event.detail
      if (detail?.type === 'ws:connected') {
        setWsConnected(true)
        setRealtimeClientId(detail.clientId)
      } else if (detail?.type === 'ws:disconnected') {
        setWsConnected(false)
        setRealtimeClientId(null)
      } else if (detail?.type === 'ws:pong') {
        setWsLatency(detail.latency)
      }
    }

    window.addEventListener(
      'dashy:ws' as never,
      handleWsMessage as EventListener,
    )
    return () => {
      window.removeEventListener(
        'dashy:ws' as never,
        handleWsMessage as EventListener,
      )
    }
  }, [enabled])

  const memoryUsage = useMemo(() => {
    if (!enabled) return null

    const performance = window.performance as Performance & {
      memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
    }

    return performance.memory ?? null
  }, [enabled])

  const registerWidget = (
    id: string,
    type: string,
    config: Record<string, unknown>,
  ) => {
    if (!enabled) return

    const existing = widgetsRef.current.get(id)
    const now = performance.now()

    widgetsRef.current.set(id, {
      id,
      type,
      renderTime: existing ? now - existing.renderTime : 0,
      configSize: JSON.stringify(config).length,
      lastUpdate: new Date().toISOString(),
      isVisible: existing?.isVisible ?? true,
    })
  }

  const updateWidgetVisibility = (id: string, isVisible: boolean) => {
    if (!enabled) return

    const existing = widgetsRef.current.get(id)
    if (existing) {
      widgetsRef.current.set(id, { ...existing, isVisible })
    }
  }

  const clearWidgetMetrics = () => {
    widgetsRef.current.clear()
  }

  const debugInfo: DebugInfo = useMemo(
    () => ({
      enabled,
      widgets: new Map(widgetsRef.current),
      wsConnected,
      wsLatency,
      realtimeClientId,
      pageLoadTime: pageLoadTime.current,
      memoryUsage,
    }),
    [enabled, wsConnected, wsLatency, realtimeClientId, memoryUsage],
  )

  return {
    enabled,
    debugInfo,
    registerWidget,
    updateWidgetVisibility,
    clearWidgetMetrics,
    setWsConnected,
    setWsLatency,
    setRealtimeClientId,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
