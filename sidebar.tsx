import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1.5 rounded-full font-medium', {
  variants: {
    variant: {
      teal: 'bg-teal-soft text-teal-fg',
      coral: 'bg-coral-soft text-coral',
      gold: 'bg-gold-soft text-gold',
      neutral: 'bg-surface-2 text-ink-2',
      outline: 'border border-border-strong text-ink-2',
    },
    size: { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-xs' },
  },
  defaultVariants: { variant: 'neutral', size: 'sm' },
})

export function Badge({
  className, variant, size, ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ variant, size }), className)} {...props} />
}
