'use client'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium ring-focus transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-[hsl(222_32%_7%)] hover:brightness-110 shadow-sm hover:shadow-glow font-semibold',
        coral: 'bg-coral text-white hover:brightness-105 shadow-sm',
        outline: 'border border-border-strong bg-surface hover:bg-surface-2 text-ink',
        ghost: 'hover:bg-surface-2 text-ink-2 hover:text-ink',
        soft: 'bg-teal-soft text-teal-fg hover:brightness-105',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm rounded-md',
        md: 'h-11 px-5 text-sm rounded-lg',
        lg: 'h-12 px-6 text-base rounded-lg',
        icon: 'h-10 w-10 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'
