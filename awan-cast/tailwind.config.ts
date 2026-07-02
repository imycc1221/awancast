import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        'panel-nested': 'var(--panel-nested)',
        ink: 'var(--ink)',
        'ink-muted': 'var(--ink-muted)',
        hairline: 'var(--hairline)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        danger: 'var(--danger)',
        sun: 'var(--sun)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        'hero': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '500' }],
        'hero-sm': ['3rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '500' }],
        'label': ['0.6875rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '700' }],
      },
      borderRadius: {
        panel: '12px',
        pill: '999px',
      },
      boxShadow: {
        hairline: '0 1px 2px rgba(0,0,0,0.04)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
