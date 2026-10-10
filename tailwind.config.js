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
        // A control's fill: tracks, quiet buttons, chips at rest.
        fill: 'rgb(var(--fill) / var(--fill-alpha))',
        card: token('card'),
        'card-raised': token('card-raised'),
        // The person's tint, and the ink that sits on it.
        tint: token('tint'),
        'on-tint': token('on-tint'),
      },
      fontFamily: {
        // One family, as on an iPhone: Geist carries the interface, every
        // figure and the large titles. `display` is kept as a name so the
        // places that ask for display type still read as such in the source.
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Sized for reading at arm's length on a phone, as iOS sizes its text
        // styles: nothing that carries meaning goes below 12px, and labels
        // are not letter-spaced — tracking only slows small type down.
        'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '-0.003em', fontWeight: '500' }],
        'label-md': ['12.5px', { lineHeight: '17px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-sm': ['13.5px', { lineHeight: '19px', letterSpacing: '-0.005em' }],
        'body-md': ['15px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        'body-lg': ['17px', { lineHeight: '26px', letterSpacing: '-0.012em' }],
        'metric-sm': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'metric-md': ['24px', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'metric-lg': ['34px', { lineHeight: '40px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-sm': ['19px', { lineHeight: '26px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '30px', letterSpacing: '-0.022em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.028em', fontWeight: '700' }],
        hero: ['48px', { lineHeight: '54px', letterSpacing: '-0.035em', fontWeight: '700' }],
        'hero-mobile': ['36px', { lineHeight: '42px', letterSpacing: '-0.03em', fontWeight: '700' }],
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
        // A raised thumb: a switch knob, a stepper key.
        thumb: '0 1px 2px rgb(0 0 0 / 0.14), 0 3px 8px -2px rgb(0 0 0 / 0.18)',
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
