'use client'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { student } from '@/data/student'
import { levels, currentLevel, xpHistory } from '@/data/gamification'
import { challenges } from '@/data/community'
import { cn } from '@/lib/utils'
import { Zap, Check, Lock, Gift } from 'lucide-react'

const toneBar: Record<string, string> = {
  teal: 'bg-teal', gold: 'bg-gold', coral: 'bg-coral', violet: 'bg-violet',
}
const toneText: Record<string, string> = {
  teal: 'text-teal-fg', gold: 'text-gold', coral: 'text-coral', violet: 'text-violet',
}

export default function RewardsPage() {
  const cur = levels[currentLevel - 1]
  const next = levels[currentLevel]
  const intoLevel = student.xp - cur.xp
  const span = next.xp - cur.xp
  const pct = Math.round((intoLevel / span) * 100)
  const totalXp = xpHistory.reduce((s, x) => s + x.xp, 0)

  return (
    <AppShell>
      <PageHeader title="Rewards & Progress" subtitle="Earn XP, level up, and unlock perks as you learn" />

      {/* Level hero */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-teal/10" />
        <div className="absolute inset-0 bg-dots opacity-30" />
        <CardBody className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:p-8">
          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-gold to-coral text-[hsl(222_32%_7%)] shadow-glow">
              <div className="text-center">
                <p className="font-display text-3xl font-black leading-none">{currentLevel}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide">level</p>
              </div>
            </div>
            <div>
              <Badge variant="gold" className="mb-1.5">{cur.name}</Badge>
              <p className="font-display text-2xl font-bold">{student.xp.toLocaleString()} XP</p>
              <p className="text-sm text-ink-2">{(next.xp - student.xp).toLocaleString()} XP to {next.name}</p>
            </div>
          </div>
          <div className="flex-1 lg:px-6">
            <div className="mb-2 flex justify-between text-xs">
              <span className="font-medium">{cur.name}</span>
              <span className="font-mono text-ink-2">{pct}%</span>
              <span className="font-medium text-ink-3">{next.name}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-gold to-coral" />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* XP breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            <h3 className="font-display text-base font-semibold">How you earned your XP</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            {xpHistory.map((x, i) => {
              const pctOf = Math.round((x.xp / totalXp) * 100)
              return (
                <div key={x.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">{x.label}</span>
                    <span className={cn('font-mono font-semibold', toneText[x.tone])}>{x.xp.toLocaleString()} XP</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pctOf}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08 }}
                      className={cn('h-full rounded-full', toneBar[x.tone])} />
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>

        {/* Active challenges */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-coral" />
            <h3 className="font-display text-base font-semibold">Active challenges</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-surface-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{c.title}</p>
                    <p className="text-xs text-ink-3">{c.desc}</p>
                  </div>
                  <Badge variant="gold" className="shrink-0">+{c.reward}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className={cn('h-full rounded-full', toneBar[c.tone])} style={{ width: `${(c.progress / c.total) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
                  <span className="font-mono">{c.progress}/{c.total}</span>
                  <span>Ends in {c.ends}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Level ladder */}
      <Card className="mt-6">
        <CardHeader><h3 className="font-display text-base font-semibold">Level path</h3></CardHeader>
        <CardBody>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            {levels.map((lv) => {
              const done = lv.level < currentLevel
              const active = lv.level === currentLevel
              return (
                <div key={lv.level}
                  className={cn('flex min-w-[130px] flex-1 flex-col items-center rounded-xl border p-4 text-center',
                    active ? 'border-gold bg-gold-soft' : done ? 'border-border bg-surface-2' : 'border-dashed border-border bg-surface')}>
                  <div className={cn('mb-2 flex h-11 w-11 items-center justify-center rounded-full font-display text-lg font-bold',
                    active ? 'bg-gold text-[hsl(222_32%_7%)]' : done ? 'bg-teal text-[hsl(222_32%_7%)]' : 'bg-surface-2 text-ink-3')}>
                    {done ? <Check className="h-5 w-5" /> : active ? lv.level : <Lock className="h-4 w-4" />}
                  </div>
                  <p className={cn('text-sm font-semibold', !done && !active && 'text-ink-3')}>{lv.name}</p>
                  <p className="font-mono text-[11px] text-ink-3">{lv.xp.toLocaleString()} XP</p>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </AppShell>
  )
}
