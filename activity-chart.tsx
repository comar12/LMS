'use client'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Search, Bell, Moon, Sun, Menu, Command } from 'lucide-react'
import { student } from '@/data/student'
import { Button } from '@/components/ui/button'
import { MobileNav } from './mobile-nav'

export function Topbar() {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border glass px-4 lg:px-8">
        <button onClick={() => setMobileOpen(true)} className="ring-focus rounded-md p-2 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            placeholder="Search courses, lessons, people…"
            className="ring-focus h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-16 text-sm placeholder:text-ink-3"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5 md:flex-none">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="h-[18px] w-[18px] dark:hidden" />
            <Moon className="hidden h-[18px] w-[18px] dark:block" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral ring-2 ring-surface" />
          </Button>
          <button className="ring-focus ml-1 flex items-center gap-2.5 rounded-full pl-1 pr-3 hover:bg-surface-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal to-teal-fg text-sm font-semibold text-[hsl(222_32%_7%)]">
              {student.avatar}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight">{student.firstName}</p>
              <p className="text-[11px] leading-tight text-ink-3">{student.level.split(' — ')[0]}</p>
            </div>
          </button>
        </div>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
