import type { Config } from 'tailwindcss';

/** Color con soporte de opacidad (`bg-brand/10`). */
const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;
/** Color cuyo token ya puede incluir alfa (tokens legados translúcidos). */
const a = (v: string) => `hsl(var(--${v}))`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: c('border'),
        background: c('background'),
        foreground: c('foreground'),
        muted: {
          DEFAULT: c('muted'),
          foreground: c('muted-foreground'),
        },
        card: c('card'),
        brand: { DEFAULT: c('brand'), foreground: c('brand-foreground') },
        demo: { DEFAULT: c('demo'), foreground: c('demo-foreground') },
        // Design System V2
        'primary-text': c('primary-text'),
        'primary-pale': c('primary-pale'),
        'accent-2': c('accent-2'),
        control: c('control'),
        success: { bg: a('success-bg'), fg: a('success-fg') },
        info: { bg: a('info-bg'), fg: a('info-fg') },
        warning: {
          bg: a('warning-bg'),
          fg: a('warning-fg'),
          soft: a('warning-soft'),
          border: a('warning-border'),
        },
        critical: {
          bg: a('critical-bg'),
          fg: a('critical-fg'),
          soft: a('critical-soft'),
          border: a('critical-border'),
          strong: a('critical-strong'),
          'border-strong': a('critical-border-strong'),
        },
        high: { bg: a('high-bg'), fg: a('high-fg') },
        ai: { bg: a('ai-bg'), fg: a('ai-fg') },
        chart: {
          pos: a('chart-pos'),
          neu: a('chart-neu'),
          neg: a('chart-neg'),
        },
        mod: { home: c('mod-home'), explorer: c('mod-explorer') },
        // Métricas de rendimiento e interacciones (addendum §4–§5)
        metric: {
          reach: c('metric-reach'),
          engagement: c('metric-engagement'),
          impressions: c('metric-impressions'),
          interactions: c('metric-interactions'),
        },
        ix: {
          likes: c('ix-likes'),
          comments: c('ix-comments'),
          shares: c('ix-shares'),
          saves: c('ix-saves'),
          reactions: c('ix-reactions'),
        },
        foxy: {
          fur: c('foxy-fur'),
          'fur-dark': c('foxy-fur-dark'),
          cream: c('foxy-cream'),
          ink: c('foxy-ink'),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        control: '10px',
        card: '16px',
        panel: '22px',
      },
      boxShadow: {
        card: '0 1px 2px hsl(var(--shadow) / 0.04), 0 4px 16px -6px hsl(var(--shadow) / 0.08)',
        lift: '0 2px 4px hsl(var(--shadow) / 0.05), 0 12px 32px -10px hsl(var(--shadow) / 0.16)',
      },
      fontFamily: {
        nunito: [
          'var(--font-nunito)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      transitionDuration: { fast: '120ms', base: '180ms', slow: '220ms' },
    },
  },
  plugins: [],
};

export default config;
