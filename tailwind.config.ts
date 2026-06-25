import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        'bg-subtle': 'hsl(var(--bg-subtle))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        ink: 'hsl(var(--ink))',
        'ink-2': 'hsl(var(--ink-2))',
        'ink-3': 'hsl(var(--ink-3))',
        teal: 'hsl(var(--teal))',
        'teal-fg': 'hsl(var(--teal-fg))',
        'teal-soft': 'hsl(var(--teal-soft))',
        coral: 'hsl(var(--coral))',
        'coral-soft': 'hsl(var(--coral-soft))',
        gold: 'hsl(var(--gold))',
        'gold-soft': 'hsl(var(--gold-soft))',
        violet: 'hsl(var(--violet))',
        rose: 'hsl(var(--rose))',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        xl: 'calc(var(--radius) + 6px)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
      },
      maxWidth: { content: '1320px' },
    },
  },
  plugins: [],
}
export default config
