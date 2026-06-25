'use client'
import { motion } from 'framer-motion'
import { weeklyActivity } from '@/data/student'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { formatDuration } from '@/lib/utils'

export function ActivityChart() {
  const max = Math.max(...weeklyActivity.map((d) => d.mins))
  const total = weeklyActivity.reduce((s, d) => s + d.mins, 0)
  return (
    <Card>
      <CardHeader className="flex items-end justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Study activity</h3>
          <p className="text-xs text-ink-3">This week</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold text-teal-fg">{formatDuration(total)}</p>
          <p className="text-xs text-ink-3">total</p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid h-36 grid-cols-7 items-end gap-2.5">
          {weeklyActivity.map((d, i) => (
            <div key={d.day} className="flex h-full flex-col items-center justify-end gap-2">
              <div className="relative flex w-full flex-1 items-end">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
                  style={{ height: `${Math.max(8, (d.mins / max) * 100)}%`, transformOrigin: 'bottom' }}
                  className="group w-full rounded-md bg-gradient-to-t from-teal/30 to-teal hover:from-teal/50"
                  title={`${d.day}: ${formatDuration(d.mins)}`}
                />
              </div>
              <span className="text-[11px] text-ink-3">{d.day}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
