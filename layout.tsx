'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { feed, leaderboard, groups } from '@/data/community'
import { cn } from '@/lib/utils'
import { Heart, MessageCircle, TrendingUp, TrendingDown, Minus, Users, Hash, Send } from 'lucide-react'

const avatarTone: Record<string, string> = {
  coral: 'from-coral to-rose', teal: 'from-teal to-teal-fg', gold: 'from-gold to-coral', violet: 'from-violet to-teal',
}

export default function CommunityPage() {
  const [liked, setLiked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(feed.map((f) => [f.id, f.liked]))
  )
  const [draft, setDraft] = useState('')

  return (
    <AppShell>
      <PageHeader title="Community" subtitle="Learn together — share wins, ask questions, find practice partners" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Feed */}
        <div className="space-y-4 lg:col-span-2">
          {/* Composer */}
          <Card>
            <CardBody className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-teal-fg text-sm font-semibold text-[hsl(222_32%_7%)]">LH</div>
              <div className="flex-1">
                <textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  placeholder="Share a win, ask a question, or find a practice partner…"
                  rows={2}
                  className="ring-focus w-full resize-none rounded-lg border border-border bg-surface-2 p-3 text-sm placeholder:text-ink-3"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" disabled={!draft.trim()}><Send className="h-3.5 w-3.5" /> Post</Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {feed.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
              <Card>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-[hsl(222_32%_7%)]', avatarTone[f.tone])}>
                      {f.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">{f.author}</span>
                        {f.role === 'Instructor' && <Badge variant="teal" size="sm">Instructor</Badge>}
                        <span className="text-xs text-ink-3">· {f.time}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                        <Hash className="h-3 w-3" />{f.group}
                      </div>
                      <p className="mt-2.5 text-sm leading-relaxed text-ink">{f.text}</p>
                      <div className="mt-3.5 flex items-center gap-4">
                        <button onClick={() => setLiked((s) => ({ ...s, [f.id]: !s[f.id] }))}
                          className={cn('ring-focus flex items-center gap-1.5 rounded-md text-xs font-medium transition', liked[f.id] ? 'text-rose' : 'text-ink-3 hover:text-ink-2')}>
                          <Heart className={cn('h-4 w-4', liked[f.id] && 'fill-rose')} />
                          {f.likes + (liked[f.id] && !f.liked ? 1 : !liked[f.id] && f.liked ? -1 : 0)}
                        </button>
                        <button className="ring-focus flex items-center gap-1.5 rounded-md text-xs font-medium text-ink-3 hover:text-ink-2">
                          <MessageCircle className="h-4 w-4" />{f.comments}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Leaderboard */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-fg" />
              <h3 className="font-display text-base font-semibold">Cohort leaderboard</h3>
            </CardHeader>
            <CardBody className="space-y-1 pt-2">
              {leaderboard.slice(0, 8).map((p) => (
                <div key={p.rank}
                  className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2', p.you && 'bg-teal-soft ring-1 ring-teal/30')}>
                  <span className={cn('w-5 text-center font-mono text-sm font-semibold', p.rank <= 3 ? 'text-gold' : 'text-ink-3')}>{p.rank}</span>
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                    p.you ? 'bg-teal text-[hsl(222_32%_7%)]' : 'bg-surface-2 text-ink-2')}>{p.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm', p.you ? 'font-semibold' : 'font-medium')}>{p.name}{p.you && ' (You)'}</p>
                    <p className="font-mono text-[11px] text-ink-3">{p.xp.toLocaleString()} XP</p>
                  </div>
                  {p.change > 0 ? <TrendingUp className="h-3.5 w-3.5 text-teal-fg" />
                    : p.change < 0 ? <TrendingDown className="h-3.5 w-3.5 text-rose" />
                    : <Minus className="h-3.5 w-3.5 text-ink-3" />}
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Groups */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Users className="h-4 w-4 text-coral" />
              <h3 className="font-display text-base font-semibold">Your groups</h3>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {groups.map((g) => (
                <button key={g.id} className="ring-focus group flex w-full items-center gap-3 rounded-lg border border-border bg-surface-2 p-3 text-left transition hover:border-border-strong">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white', avatarTone[g.tone])}>
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      {g.active && <span className="h-1.5 w-1.5 rounded-full bg-teal" />}
                    </div>
                    <p className="text-xs text-ink-3">{g.members.toLocaleString()} members</p>
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
