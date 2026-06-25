export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle cx="16" cy="16" r="14" stroke="hsl(var(--teal))" strokeWidth="1.5" opacity="0.3" />
        <circle cx="16" cy="6" r="2.5" fill="hsl(var(--teal))" />
        <circle cx="25" cy="20" r="2.5" fill="hsl(var(--coral))" />
        <circle cx="7" cy="20" r="2.5" fill="hsl(var(--gold))" />
        <circle cx="16" cy="16" r="3" fill="hsl(var(--teal))" />
        <path d="M16 9v4M16 16l7 3M16 16l-7 3" stroke="hsl(var(--teal))" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight">Axon</span>
    </div>
  )
}
