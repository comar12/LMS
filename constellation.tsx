'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { navItems } from './nav-config'
import { Logo } from '@/components/shared/logo'
import { student } from '@/data/student'
import { cn } from '@/lib/utils'
import { Flame } from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="ring-focus rounded-md"><Logo /></Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ring-focus transition-colors',
                active ? 'text-teal-fg' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-teal-soft"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <item.icon className={cn('relative z-10 h-[18px] w-[18px]', active && 'text-teal-fg')} strokeWidth={2} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="m-3 rounded-xl border border-border bg-gradient-to-br from-coral-soft to-transparent p-4">
        <div className="flex items-center gap-2 text-coral">
          <Flame className="h-4 w-4 fill-coral" />
          <span className="font-display text-2xl font-bold">{student.streak}</span>
          <span className="text-xs font-medium text-ink-2">day streak</span>
        </div>
        <p className="mt-1 text-xs text-ink-3">Keep it alive — study today to reach 25.</p>
      </div>
    </aside>
  )
}
