import * as React from 'react'
import { cn } from '@/lib/utils'

interface SkipToContentProps extends React.ComponentProps<'a'> {
  contentId?: string
}

function SkipToContent({
  contentId = 'main-content',
  className,
  children,
  ...props
}: SkipToContentProps) {
  return (
    <a href={`#${contentId}`} className={cn('skip-link', className)} {...props}>
      {children || 'Skip to main content'}
    </a>
  )
}

interface MainContentProps extends React.ComponentProps<'main'> {
  contentId?: string
}

function MainContent({
  contentId = 'main-content',
  className,
  children,
  ...props
}: MainContentProps) {
  return (
    <main id={contentId} className={cn('outline-none', className)} {...props}>
      {children}
    </main>
  )
}

function VisuallyHidden({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <span className={cn('sr-only', className)}>{children}</span>
}

function LiveRegion({
  children,
  politeness = 'polite',
  className,
}: {
  children: React.ReactNode
  politeness?: 'polite' | 'assertive' | 'off'
  className?: string
}) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  )
}

export { SkipToContent, MainContent, VisuallyHidden, LiveRegion }
