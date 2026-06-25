'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Play } from 'lucide-react'
import type { Course } from '@/data/student'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

const trackTone: Record<string, 'teal' | 'coral' | 'gold'> = {
  'Career Track': 'teal', 'Exam Prep': 'coral', Fluency: 'gold', Foundations: 'teal',
}

export function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const done = course.progress === 100
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
      <Link href={`/courses/${course.id}`}
        className="ring-focus group block overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className={`relative h-28 bg-gradient-to-br ${course.cover}`}>
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className="absolute left-4 top-4">
            <Badge variant={trackTone[course.track] ?? 'neutral'}>{course.track}</Badge>
          </div>
          {done && (
            <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-xs font-medium text-teal-fg">
              <CheckCircle2 className="h-3.5 w-3.5" /> Done
            </div>
          )}
          <div className="absolute bottom-3 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-md transition group-hover:scale-110">
            <Play className="h-5 w-5 fill-teal text-teal" />
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-display font-semibold leading-snug text-balance">{course.title}</h3>
          <p className="mt-1 text-xs text-ink-3">{course.instructor}</p>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-ink-3">{course.completedLessons}/{course.totalLessons} lessons</span>
              <span className="font-mono font-medium text-ink-2">{course.progress}%</span>
            </div>
            <Progress value={course.progress} tone={course.color === 'coral' ? 'coral' : course.color === 'gold' ? 'gold' : 'teal'} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
