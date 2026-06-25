'use client'
import { motion } from 'framer-motion'
import { Flame, Star, TrendingUp, Target } from 'lucide-react'
import { student } from '@/data/student'

const tiles = [
  { icon: Flame, label: 'Day streak', value: student.streak, tone: 'text-coral', bg: 'bg-coral-soft' },
  { icon: Star, label: 'Total XP', value: student.xp.toLocaleString(), tone: 'text-gold', bg: 'bg-gold-soft' },
  { icon: TrendingUp, label: 'Cohort rank', value: `#${student.rank}`, tone: 'text-teal-fg', bg: 'bg-teal-soft' },
  { icon: Target, label: 'Days active', value: student.joinedDays, tone: 'text-violet', bg: 'bg-surface-2' },
]

export function StatTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg}`}>
            <t.icon className={`h-[18px] w-[18px] ${t.tone}`} />
          </div>
          <p className="font-display text-2xl font-bold">{t.value}</p>
          <p className="text-xs text-ink-3">{t.label}</p>
        </motion.div>
      ))}
    </div>
  )
}
