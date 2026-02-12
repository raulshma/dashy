import { HugeiconsIcon } from '@hugeicons/react'
import { cva } from 'class-variance-authority'
import type { HugeiconsIconProps } from '@hugeicons/react'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const iconVariants = cva('shrink-0', {
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
      xl: 'size-8',
      '2xl': 'size-10',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

const strokeWidthMap = {
  thin: 1,
  normal: 1.5,
  medium: 2,
  thick: 2.5,
} as const

type IconStroke = keyof typeof strokeWidthMap

export interface IconProps extends VariantProps<typeof iconVariants> {
  icon: HugeiconsIconProps['icon']
  strokeWidth?: IconStroke
  className?: string
}

function Icon({
  className,
  size,
  strokeWidth = 'normal',
  icon,
  ...props
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      strokeWidth={strokeWidthMap[strokeWidth]}
      className={cn(iconVariants({ size, className }))}
      {...props}
    />
  )
}

export { Icon, iconVariants }
