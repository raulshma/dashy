import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const glassCardVariants = cva(
  'rounded-2xl transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-expo)]',
  {
    variants: {
      variant: {
        default:
          'glass border-[oklch(1_0_0/var(--glass-border-opacity))] shadow-sm',
        elevated: 'glass shadow-lg glass-glow',
        subtle:
          'glass-subtle border-[oklch(1_0_0/calc(var(--glass-border-opacity)*0.5))]',
        heavy: 'glass-heavy shadow-xl glass-glow',
        solid: 'bg-card border border-border shadow-sm',
        outline: 'bg-transparent border border-border',
      },
      interactive: {
        true: 'cursor-pointer hover:scale-[1.01] hover:shadow-lg hover:border-[oklch(1_0_0/calc(var(--glass-border-opacity)*2))] active:scale-[0.99]',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-3',
        default: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      interactive: false,
      padding: 'default',
    },
  },
)

export interface GlassCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

function GlassCard({
  className,
  variant,
  interactive,
  padding,
  ...props
}: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        glassCardVariants({ variant, interactive, padding, className }),
      )}
      {...props}
    />
  )
}

function GlassCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  )
}

function GlassCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="glass-card-title"
      className={cn(
        'text-lg font-semibold leading-none tracking-tight',
        className,
      )}
      {...props}
    />
  )
}

function GlassCardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="glass-card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function GlassCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn('pt-0', className)}
      {...props}
    />
  )
}

function GlassCardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  )
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
  glassCardVariants,
}
