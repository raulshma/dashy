/**
 * Widget Virtualization Hook
 *
 * Uses Intersection Observer to track which widgets are visible in the viewport.
 * Only renders content for visible widgets to improve performance with many widgets.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface VisibilityMap {
  [widgetId: string]: boolean
}

export interface UseWidgetVisibilityOptions {
  rootMargin?: string
  threshold?: number
  debounceMs?: number
}

export function useWidgetVisibility(
  widgetIds: string[],
  options: UseWidgetVisibilityOptions = {},
): {
  visibilityMap: VisibilityMap
  setVisible: (widgetId: string, isVisible: boolean) => void
  observerRef: React.RefObject<IntersectionObserver | null>
} {
  const { rootMargin = '100px', threshold = 0.01, debounceMs = 100 } = options

  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>(() => {
    const initial: VisibilityMap = {}
    for (const id of widgetIds) {
      initial[id] = false
    }
    return initial
  })

  const observerRef = useRef<IntersectionObserver | null>(null)
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  useEffect(() => {
    const initial: VisibilityMap = {}
    for (const id of widgetIds) {
      initial[id] = visibilityMap[id] ?? false
    }
    setVisibilityMap(initial)
  }, [widgetIds.join(',')])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const widgetId = entry.target.getAttribute('data-widget-id')
          if (!widgetId) continue

          const existingTimer = debounceTimersRef.current.get(widgetId)
          if (existingTimer) {
            clearTimeout(existingTimer)
            debounceTimersRef.current.delete(widgetId)
          }

          if (debounceMs > 0) {
            const timer = setTimeout(() => {
              setVisibilityMap((prev) => ({
                ...prev,
                [widgetId]: entry.isIntersecting,
              }))
            }, debounceMs)
            debounceTimersRef.current.set(widgetId, timer)
          } else {
            setVisibilityMap((prev) => ({
              ...prev,
              [widgetId]: entry.isIntersecting,
            }))
          }
        }
      },
      {
        rootMargin,
        threshold,
      },
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      for (const timer of debounceTimersRef.current.values()) {
        clearTimeout(timer)
      }
      debounceTimersRef.current.clear()
    }
  }, [rootMargin, threshold, debounceMs])

  const setVisible = useCallback((widgetId: string, isVisible: boolean) => {
    setVisibilityMap((prev) => ({
      ...prev,
      [widgetId]: isVisible,
    }))
  }, [])

  return { visibilityMap, setVisible, observerRef }
}

export function useObserveWidget(
  widgetId: string,
  observer: IntersectionObserver | null,
): (element: HTMLElement | null) => void {
  const elementRef = useRef<HTMLElement | null>(null)

  return useCallback(
    (element: HTMLElement | null) => {
      if (elementRef.current && observer) {
        observer.unobserve(elementRef.current)
      }

      elementRef.current = element

      if (element && observer) {
        element.setAttribute('data-widget-id', widgetId)
        observer.observe(element)
      }
    },
    [widgetId, observer],
  )
}

export function useVisibleWidgetCount(visibilityMap: VisibilityMap): {
  visible: number
  total: number
} {
  const total = Object.keys(visibilityMap).length
  const visible = Object.values(visibilityMap).filter(Boolean).length
  return { visible, total }
}
