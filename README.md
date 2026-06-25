# Axon — Student Portal

A next-generation learning ecosystem (Student Portal). Built brand-new, not derived from any template.

## Stack
Next.js 14 · TypeScript · Tailwind CSS · Framer Motion · lucide-react · next-themes

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Build for production
This repo ships with **two layout files**:

- `src/app/layout.tsx` — **build-safe**, uses self-hosted `@fontsource` fonts (works in any sandbox/offline build).
- `src/app/layout.production.tsx` — **production**, uses `next/font/google` (Sora, Inter, JetBrains Mono) for CDN-optimized delivery.

To ship with Google Fonts, swap them:
```bash
mv src/app/layout.tsx src/app/layout.fontsource.tsx
mv src/app/layout.production.tsx src/app/layout.tsx
npm run build
```
Both produce identical visual output; the only difference is where fonts load from.

## Pages built this round
| Route | Screen |
|-------|--------|
| `/` | Dashboard — stat tiles, continue-learning hero, **Knowledge Constellation** skill map, study-activity chart, upcoming week, active courses |
| `/rewards` | Gamification — level hero, XP breakdown, active challenges, level path ladder |
| `/community` | Community — post composer, activity feed, cohort leaderboard, your groups |
| `/achievements` | Achievements — earned badges + in-progress with rarity tiers |

Routes scaffolded in nav but not yet built: `/courses`, `/assignments`, `/explore`, `/career`.

## Design system
- **Identity:** deep-space dark default; teal "current" + coral "spark" + gold accents
- **Type:** Sora (display) · Inter (body) · JetBrains Mono (data)
- **Tokens:** all HSL CSS variables in `globals.css`, full light/dark sets
- **Signature:** the Knowledge Constellation — skills as connected nodes sized by mastery
- Accessibility: visible focus rings, reduced-motion support, responsive to mobile

## Data
All seed data lives in `src/data/` (student, curriculum, community, gamification). Swap for a real API later — components read from typed objects.
