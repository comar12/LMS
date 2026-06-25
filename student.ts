@import '@fontsource/sora/400.css';
@import '@fontsource/sora/500.css';
@import '@fontsource/sora/600.css';
@import '@fontsource/sora/700.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: 210 40% 98%;
  --bg-subtle: 210 30% 95%;
  --surface: 0 0% 100%;
  --surface-2: 210 30% 97%;
  --border: 214 25% 88%;
  --border-strong: 214 20% 78%;
  --ink: 215 35% 12%;
  --ink-2: 215 18% 38%;
  --ink-3: 215 12% 55%;
  --teal: 178 70% 38%;
  --teal-fg: 178 75% 30%;
  --teal-soft: 178 55% 92%;
  --coral: 8 80% 62%;
  --coral-soft: 8 80% 95%;
  --gold: 38 90% 55%;
  --gold-soft: 38 90% 93%;
  --violet: 256 60% 60%;
  --rose: 350 75% 58%;
  --radius: 0.875rem;
  --shadow-sm: 0 1px 2px hsl(215 35% 12% / 0.05), 0 1px 1px hsl(215 35% 12% / 0.04);
  --shadow-md: 0 4px 16px hsl(215 35% 12% / 0.08), 0 2px 4px hsl(215 35% 12% / 0.04);
  --shadow-lg: 0 16px 48px hsl(215 35% 12% / 0.12), 0 4px 12px hsl(215 35% 12% / 0.06);
  --shadow-glow: 0 0 0 1px hsl(178 70% 38% / 0.2), 0 8px 32px hsl(178 70% 38% / 0.18);
}

.dark {
  --bg: 222 32% 7%;
  --bg-subtle: 222 28% 10%;
  --surface: 222 26% 11%;
  --surface-2: 222 24% 14%;
  --border: 220 18% 20%;
  --border-strong: 220 16% 28%;
  --ink: 210 30% 96%;
  --ink-2: 214 15% 70%;
  --ink-3: 215 12% 52%;
  --teal: 174 72% 50%;
  --teal-fg: 174 72% 56%;
  --teal-soft: 178 40% 18%;
  --coral: 8 85% 66%;
  --coral-soft: 8 45% 20%;
  --gold: 40 92% 60%;
  --gold-soft: 38 50% 18%;
  --violet: 256 70% 68%;
  --rose: 350 80% 64%;
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.3);
  --shadow-md: 0 4px 16px hsl(0 0% 0% / 0.4), 0 2px 4px hsl(0 0% 0% / 0.3);
  --shadow-lg: 0 16px 48px hsl(0 0% 0% / 0.55), 0 4px 12px hsl(0 0% 0% / 0.4);
  --shadow-glow: 0 0 0 1px hsl(174 72% 50% / 0.25), 0 8px 32px hsl(174 72% 50% / 0.22);
}

* { border-color: hsl(var(--border)); }
html { scroll-behavior: smooth; }
body {
  background-color: hsl(var(--bg));
  color: hsl(var(--ink));
  font-family: var(--font-inter), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}
.font-display { font-family: var(--font-sora), system-ui, sans-serif; letter-spacing: -0.02em; }
.font-mono { font-family: var(--font-mono), 'JetBrains Mono', monospace; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border-strong)); border-radius: 6px; border: 2px solid hsl(var(--bg)); }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--ink-3)); }

@layer utilities {
  .text-balance { text-wrap: balance; }
  .bg-grid {
    background-image: linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px);
    background-size: 32px 32px;
  }
  .bg-dots { background-image: radial-gradient(hsl(var(--border-strong) / 0.6) 1px, transparent 1px); background-size: 20px 20px; }
  .glass { background: hsl(var(--surface) / 0.72); backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); }
  .ring-focus:focus-visible { outline: 2px solid hsl(var(--teal)); outline-offset: 2px; }
}

@keyframes pulse-node { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes shimmer { 100% { transform: translateX(100%); } }
.skeleton { position: relative; overflow: hidden; background: hsl(var(--surface-2)); }
.skeleton::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, hsl(var(--ink) / 0.06), transparent); animation: shimmer 1.6s infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
