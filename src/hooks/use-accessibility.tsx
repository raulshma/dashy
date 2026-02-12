import * as React from 'react'

function useAnnounce() {
  const [announcement, setAnnouncement] = React.useState('')

  const announce = React.useCallback(
    (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
      setAnnouncement('')
      requestAnimationFrame(() => {
        setAnnouncement(message)
      })
    },
    [],
  )

  const LiveAnnouncer = React.useCallback(
    () => (
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        key={announcement}
      >
        {announcement}
      </div>
    ),
    [announcement],
  )

  return { announce, LiveAnnouncer }
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return reducedMotion
}

function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active = true,
): React.RefObject<T | null> {
  const ref = React.useRef<T | null>(null)

  React.useEffect(() => {
    if (!active || !ref.current) return

    const element = ref.current
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement?.focus()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => {
      element.removeEventListener('keydown', handleKeyDown)
    }
  }, [active])

  return ref
}

export { useAnnounce, useReducedMotion, useFocusTrap }
