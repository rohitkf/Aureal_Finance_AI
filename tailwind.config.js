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
        // Geist carries the interface and every figure; Jakarta is reserved
        // for display type, where its wider geometry earns its place.
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Jakarta', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
        // Concentric pairs for the double-bezel: an inner radius is the
        // outer radius minus the tray padding.
        bezel: '2rem',
        'bezel-core': '1.625rem',
        plate: '1.375rem',
      },
      boxShadow: {
        // Wide, highly diffused ambient light — never a harsh drop shadow.
        ambient: '0 1px 2px rgb(var(--ambient) / var(--ambient-a)), 0 18px 40px -22px rgb(var(--ambient) / var(--ambient-b))',
        float: '0 2px 6px rgb(var(--ambient) / var(--ambient-a)), 0 32px 64px -28px rgb(var(--ambient) / var(--ambient-b))',
        sheet: '0 -12px 60px -18px rgb(var(--ambient) / var(--ambient-b))',
        'inner-top': 'inset 0 1px 0 0 rgb(255 255 255 / 0.08)',
      },
      transitionTimingFunction: {
        // The house curve: heavy start, long glide out.
        fluid: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: { 400: '400ms', 600: '600ms', 700: '700ms', 900: '900ms' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { transform: 'translateY(20px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        // A very slow drift, so the backdrop is never quite static.
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.08)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 420ms cubic-bezier(0.32, 0.72, 0, 1)',
        'sheet-up': 'sheet-up 480ms cubic-bezier(0.32, 0.72, 0, 1)',
        shimmer: 'shimmer 1.8s infinite',
        drift: 'drift 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
