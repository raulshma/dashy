import { useTheme } from 'next-themes'
import type { ToasterProps } from 'sonner'
import { Toaster as Sonner } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from '@hugeicons/core-free-icons'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      richColors
      closeButton
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'glass-toast group-[.toaster]:bg-[var(--surface-glass)] group-[.toaster]:backdrop-blur-xl group-[.toaster]:saturate-180 group-[.toaster]:border-[oklch(1_0_0/var(--glass-border-opacity))] group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:pr-8',
          title:
            'group-[.toaster]:text-foreground group-[.toaster]:font-medium',
          description: 'group-[.toaster]:text-muted-foreground',
          actionButton:
            'group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground group-[.toaster]:rounded-lg group-[.toaster]:font-medium group-[.toaster]:transition-all group-[.toaster]:hover:opacity-90',
          cancelButton:
            'group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground group-[.toaster]:rounded-lg group-[.toaster]:font-medium',
          closeButton:
            '!bg-[var(--surface-glass)] !border-[oklch(1_0_0/var(--glass-border-opacity))] !rounded-lg hover:!bg-accent !right-1 !top-1/2 !-translate-y-1/2 !left-auto',
          success: 'group-[.toaster]:text-[oklch(0.72_0.16_145)]',
          error: 'group-[.toaster]:text-[oklch(0.65_0.2_25)]',
          warning: 'group-[.toaster]:text-[oklch(0.75_0.18_85)]',
          info: 'group-[.toaster]:text-[oklch(0.72_0.16_265)]',
        },
      }}
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            className="size-[18px] text-[oklch(0.72_0.16_145)]"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-[18px] text-[oklch(0.72_0.16_265)]"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="size-[18px] text-[oklch(0.75_0.18_85)]"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            className="size-[18px] text-[oklch(0.65_0.2_25)]"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-[18px] animate-spin text-primary"
          />
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }
