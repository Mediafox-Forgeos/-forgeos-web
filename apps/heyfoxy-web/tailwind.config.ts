import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: 'hsl(var(--card))',
        brand: 'hsl(var(--brand))',
        demo: 'hsl(var(--demo))',
      },
      borderRadius: { lg: 'var(--radius)' },
    },
  },
  plugins: [],
};

export default config;
