import { AppShell } from '@/components/layout/app-shell'
import { ContinueCard } from '@/components/dashboard/continue-card'
import { StatTiles } from '@/components/dashboard/stat-tiles'
import { Constellation } from '@/components/dashboard/constellation'
import { UpcomingList } from '@/components/dashboard/upcoming-list'
import { ActivityChart } from '@/components/dashboard/activity-chart'
import { CourseCard } from '@/components/shared/course-card'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { student, courses } from '@/data/student'
import { Sparkles } from 'lucide-react'

export default function DashboardPage() {
  const hour = 9
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const active = courses.filter((c) => c.progress < 100)
  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm text-ink-3">{greeting},</p>
        <h1 className="font-display text-2xl font-bold lg:text-3xl">{student.firstName} Hassan</h1>
      </div>

      <StatTiles />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContinueCard />
          <ActivityChart />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-fg" />
              <h3 className="font-display text-base font-semibold">Your skill map</h3>
            </CardHeader>
            <CardBody className="flex flex-col items-center pt-2">
              <Constellation />
              <p className="mt-2 text-center text-xs text-ink-3">
                Node size reflects mastery. Grammar leads at 91 — Writing is your biggest growth area.
              </p>
            </CardBody>
          </Card>
          <UpcomingList />
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Active courses</h2>
          <a href="/courses" className="text-sm font-medium text-teal-fg hover:underline">All courses →</a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
        </div>
      </div>
    </AppShell>
  )
}
