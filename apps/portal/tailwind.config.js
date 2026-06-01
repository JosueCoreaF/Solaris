/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      // ── Tremor design tokens ──────────────────────────────────────────────
      colors: {
        tremor: {
          brand: {
            faint:     '#eff6ff',
            muted:     '#bfdbfe',
            subtle:    '#60a5fa',
            DEFAULT:   '#3b82f6',
            emphasis:  '#1d4ed8',
            inverted:  '#ffffff',
          },
          background: {
            muted:     '#f9fafb',
            subtle:    '#f3f4f6',
            DEFAULT:   '#ffffff',
            emphasis:  '#374151',
          },
          border:  { DEFAULT: '#e5e7eb' },
          ring:    { DEFAULT: '#e5e7eb' },
          content: {
            subtle:   '#9ca3af',
            DEFAULT:  '#6b7280',
            emphasis: '#374151',
            strong:   '#111827',
            inverted: '#ffffff',
          },
        },
      },
      borderRadius: {
        'tremor-small':   '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full':    '9999px',
      },
      fontSize: {
        'tremor-label':   ['0.75rem'],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title':   ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric':  ['1.875rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        'tremor-input':    '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card':     '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      // ── Portal custom animations ──────────────────────────────────────────
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        fadeIn:  'fadeIn 0.4s ease-out forwards',
      },
    },
  },
  safelist: [
    { pattern: /^tremor-/ },
    { pattern: /^bg-tremor-/ },
    { pattern: /^text-tremor-/ },
    { pattern: /^border-tremor-/ },
    { pattern: /^ring-tremor-/ },
    { pattern: /^shadow-tremor-/ },
    { pattern: /^rounded-tremor-/ },
  ],
  plugins: [],
};
