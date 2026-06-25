'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { navItems } from './nav-config'
import { Logo } from '@/components/shared/logo'
import { cn } from '@/lib/utils'

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface p-4 lg:hidden">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button onClick={onClose} className="ring-focus rounded-md p-2" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} onClick={onClose}
                    className={cn('flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium',
                      active ? 'bg-teal-soft text-teal-fg' : 'text-ink-2 hover:bg-surface-2')}>
                    <item.icon className="h-[18px] w-[18px]" />{item.label}
                  </Link>
                )
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
