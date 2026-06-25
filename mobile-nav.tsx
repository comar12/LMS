import { cn } from '@/lib/utils'

export function Progress({ value, className, tone = 'teal' }: { value: number; className?: string; tone?: 'teal' | 'coral' | 'gold' }) {
  const bar = tone === 'coral' ? 'bg-coral' : tone === 'gold' ? 'bg-gold' : 'bg-teal'
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cn('h-full rounded-full transition-all duration-700', bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
