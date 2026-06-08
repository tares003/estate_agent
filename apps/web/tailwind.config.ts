import type { Config } from 'tailwindcss';

// Tailwind is the utility layer; every theme value resolves to a design-token
// CSS variable (var(--…)) so app markup stays token-driven (G7). Preflight is
// off — @estate/tokens' base.css is the canonical reset. Breakpoints use the
// literal token px (media queries can't take var()), sourced from tokens.css.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
      '3xl': '2560px',
    },
    extend: {
      colors: {
        'brand-primary': 'var(--colour-brand-primary)',
        'brand-primary-hover': 'var(--colour-brand-primary-hover)',
        'brand-accent': 'var(--colour-brand-accent)',
        'text-primary': 'var(--colour-text-primary)',
        'text-secondary': 'var(--colour-text-secondary)',
        'text-muted': 'var(--colour-text-muted)',
        'surface-base': 'var(--colour-surface-base)',
        'surface-raised': 'var(--colour-surface-raised)',
        'surface-sunken': 'var(--colour-surface-sunken)',
        border: 'var(--colour-border)',
        divider: 'var(--colour-divider)',
        success: 'var(--colour-success)',
        warning: 'var(--colour-warning)',
        danger: 'var(--colour-danger)',
        info: 'var(--colour-info)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
        20: 'var(--space-20)',
        24: 'var(--space-24)',
        32: 'var(--space-32)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-pill)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      maxWidth: {
        container: 'var(--size-container-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};

export default config;
