import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const inputVariants = cva(
  'h-9 border px-3 py-1 text-base transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] file:h-7 file:text-sm file:font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-xl',
        glass:
          'glass border-[oklch(1_0_0/var(--glass-border-opacity))] rounded-xl focus-visible:border-[oklch(1_0_0/calc(var(--glass-border-opacity)*2))] focus-visible:ring-primary/30',
        'glass-elevated':
          'glass-heavy border-[oklch(1_0_0/var(--glass-border-opacity))] rounded-xl shadow-lg focus-visible:border-[oklch(1_0_0/calc(var(--glass-border-opacity)*2))] focus-visible:ring-primary/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
