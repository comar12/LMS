'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Clock } from 'lucide-react'
import { courses } from '@/data/student'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

export function ContinueCard() {
  const c = courses[0]
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-md">
      <div className={`absolute inset-0 bg-gradient-to-br ${c.cover} opacity-60`} />
      <div className="absolute inset-0 bg-dots opacity-40" />
      <div className="relative p-6 lg:p-7">
        <Badge variant="teal" className="mb-3">Continue learning</Badge>
        <h2 className="font-display text-2xl font-semibold text-balance lg:text-3xl">{c.nextLesson}</h2>
        <p className="mt-1.5 text-sm text-ink-2">{c.title} · with {c.instructor}</p>
        <div className="mt-5 flex items-center gap-4">
          <Link href={`/courses/${c.id}/learn`}
            className="ring-focus inline-flex h-12 items-center gap-2 rounded-lg bg-teal px-6 font-semibold text-[hsl(222_32%_7%)] shadow-glow transition hover:brightness-110">
            <Play className="h-5 w-5 fill-current" /> Resume lesson
          </Link>
          <div className="flex items-center gap-1.5 text-sm text-ink-2">
            <Clock className="h-4 w-4" /> ~{c.hoursLeft}h left
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-ink-2">
            <span>{c.completedLessons} of {c.totalLessons} lessons</span>
            <span className="font-mono font-medium text-teal-fg">{c.progress}%</span>
          </div>
          <Progress value={c.progress} />
        </div>
      </div>
    </motion.div>
  )
}
