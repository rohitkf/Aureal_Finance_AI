/** @type {import('tailwindcss').Config} */

// Every colour is a semantic token backed by a CSS variable holding an RGB
// triplet, so opacity modifiers (`bg-primary/20`) keep working and light and
// dark mode can be designed independently rather than inverted.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        'surface-lowest': token('surface-lowest'),
        'surface-low': token('surface-low'),
        'surface-base': token('surface-base'),
        'surface-high': token('surface-high'),
        'surface-highest': token('surface-highest'),
        'surface-bright': token('surface-bright'),

        border: token('border'),
        'border-strong': token('border-strong'),

        text: token('text'),
        muted: token('muted'),
        faint: token('faint'),

        primary: token('primary'),
        'primary-strong': token('primary-strong'),
        'on-primary': token('on-primary'),
        'primary-soft': token('primary-soft'),

        secondary: token('secondary'),
        'on-secondary': token('on-secondary'),

        success: token('success'),
        'on-success': token('on-success'),
        warning: token('warning'),
        'on-warning': token('on-warning'),
        danger: token('danger'),
        'on-danger': token('on-danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '600' }],
        'body-sm': ['13px', { lineHeight: '18px' }],
        'body-md': ['14px', { lineHeight: '22px' }],
        'body-lg': ['16px', { lineHeight: '26px' }],
        'metric-sm': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'metric-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'metric-lg': ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '26px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
        hero: ['48px', { lineHeight: '56px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'hero-mobile': ['36px', { lineHeight: '44px', letterSpacing: '-0.025em', fontWeight: '700' }],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem', '3xl': '1.25rem' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.08), 0 16px 40px -16px rgb(var(--shadow) / 0.28)',
        sheet: '0 -8px 40px -12px rgb(var(--shadow) / 0.4)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-up': 'sheet-up 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
