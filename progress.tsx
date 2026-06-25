import { Flame, Crown, Trophy, Sunrise, BookOpen, Mic, CalendarCheck, Target, Heart, GraduationCap, Moon, Award } from 'lucide-react'
const map: Record<string, typeof Flame> = {
  flame: Flame, crown: Crown, trophy: Trophy, sunrise: Sunrise, 'book-open': BookOpen, book: BookOpen,
  mic: Mic, 'calendar-check': CalendarCheck, target: Target, heart: Heart, 'graduation-cap': GraduationCap, moon: Moon,
}
export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Award
  return <Icon className={className} />
}
