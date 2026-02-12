import * as React from 'react'

const BREAKPOINTS = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  '2xl': 672,
  '3xl': 768,
  '4xl': 896,
} as const

type Breakpoint = keyof typeof BREAKPOINTS

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['4xl']) return '4xl'
  if (width >= BREAKPOINTS['3xl']) return '3xl'
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

function useBreakpoint(breakpoint: Breakpoint): boolean {
  const px = BREAKPOINTS[breakpoint]
  return useMediaQuery(`(min-width: ${px}px)`)
}

function useCurrentBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>('xs')

  React.useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getBreakpoint(window.innerWidth))
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return breakpoint
}

function useIsMobile(): boolean {
  return !useBreakpoint('md')
}

function useIsTablet(): boolean {
  const isMd = useBreakpoint('md')
  const is2xl = useBreakpoint('2xl')
  return isMd && !is2xl
}

function useIsDesktop(): boolean {
  return useBreakpoint('2xl')
}

export {
  BREAKPOINTS,
  useMediaQuery,
  useBreakpoint,
  useCurrentBreakpoint,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
}

export type { Breakpoint }
