/**
 * @estate/tokens — type-safe accessor for the design tokens declared in
 * `tokens.css`. Every value is a `var(--token)` reference, never a raw value,
 * so consuming code stays G7-compliant (the raw values live only in tokens.css).
 *
 * Import the CSS once at the app root: `import '@estate/tokens/tokens.css';`
 * then reference tokens in code via this accessor, e.g.
 *   style={{ color: colour.brand.primary, padding: space[4] }}
 *
 * The `tokens` aggregate and `tokens.css` are kept in exact sync by the drift
 * test in index.test.ts (every declared custom property is referenced once).
 */

/** Build a CSS custom-property reference: `v('space-4')` -> `'var(--space-4)'`. */
const v = (name: string): string => `var(--${name})`;

export const colour = {
  brand: {
    primary: v('colour-brand-primary'),
    primaryHover: v('colour-brand-primary-hover'),
    primaryOn: v('colour-brand-primary-on'),
    accent: v('colour-brand-accent'),
    accentHover: v('colour-brand-accent-hover'),
    accentOn: v('colour-brand-accent-on'),
  },
  text: {
    primary: v('colour-text-primary'),
    secondary: v('colour-text-secondary'),
    muted: v('colour-text-muted'),
    onDark: v('colour-text-on-dark'),
    inverse: v('colour-text-inverse'),
  },
  surface: {
    base: v('colour-surface-base'),
    raised: v('colour-surface-raised'),
    sunken: v('colour-surface-sunken'),
  },
  border: v('colour-border'),
  divider: v('colour-divider'),
  status: {
    available: v('colour-status-available'),
    underOffer: v('colour-status-under-offer'),
    soldStc: v('colour-status-sold-stc'),
    sold: v('colour-status-sold'),
    letAgreed: v('colour-status-let-agreed'),
    let: v('colour-status-let'),
    withdrawn: v('colour-status-withdrawn'),
  },
  priority: {
    emergency: v('colour-priority-emergency'),
    urgent: v('colour-priority-urgent'),
    standard: v('colour-priority-standard'),
    low: v('colour-priority-low'),
  },
  semantic: {
    success: v('colour-success'),
    warning: v('colour-warning'),
    danger: v('colour-danger'),
    info: v('colour-info'),
  },
  focusRing: v('colour-focus-ring'),
  selection: v('colour-selection'),
} as const;

export const fontFamily = {
  display: v('font-display'),
  body: v('font-body'),
  mono: v('font-mono'),
} as const;

export const fontWeight = {
  light: v('weight-light'),
  regular: v('weight-regular'),
  medium: v('weight-medium'),
  semibold: v('weight-semibold'),
  bold: v('weight-bold'),
} as const;

/** A type-scale step: font-size, line-height and letter-spacing references. */
const typeStep = (slug: string) => ({
  size: v(`text-${slug}`),
  lh: v(`text-${slug}-lh`),
  ls: v(`text-${slug}-ls`),
});

export const type = {
  displayXl: typeStep('display-xl'),
  displayLg: typeStep('display-lg'),
  displayMd: typeStep('display-md'),
  displaySm: typeStep('display-sm'),
  headingLg: typeStep('heading-lg'),
  headingMd: typeStep('heading-md'),
  headingSm: typeStep('heading-sm'),
  bodyLg: typeStep('body-lg'),
  bodyMd: typeStep('body-md'),
  bodySm: typeStep('body-sm'),
  caption: typeStep('caption'),
} as const;

export const space = {
  0: v('space-0'),
  1: v('space-1'),
  2: v('space-2'),
  3: v('space-3'),
  4: v('space-4'),
  5: v('space-5'),
  6: v('space-6'),
  8: v('space-8'),
  10: v('space-10'),
  12: v('space-12'),
  16: v('space-16'),
  20: v('space-20'),
  24: v('space-24'),
  32: v('space-32'),
} as const;

export const size = {
  container: {
    sm: v('size-container-sm'),
    md: v('size-container-md'),
    lg: v('size-container-lg'),
    xl: v('size-container-xl'),
    '2xl': v('size-container-2xl'),
  },
  button: {
    sm: v('size-button-sm'),
    md: v('size-button-md'),
    lg: v('size-button-lg'),
  },
  input: {
    md: v('size-input-md'),
  },
  icon: {
    sm: v('size-icon-sm'),
    md: v('size-icon-md'),
    lg: v('size-icon-lg'),
    xl: v('size-icon-xl'),
  },
  touchTargetMin: v('size-touch-target-min'),
} as const;

export const ratio = {
  card: v('ratio-card'),
  hero: v('ratio-hero'),
  avatar: v('ratio-avatar'),
  floorplan: v('ratio-floorplan'),
} as const;

export const radius = {
  sm: v('radius-sm'),
  md: v('radius-md'),
  lg: v('radius-lg'),
  xl: v('radius-xl'),
  pill: v('radius-pill'),
  circle: v('radius-circle'),
} as const;

export const shadow = {
  xs: v('shadow-xs'),
  sm: v('shadow-sm'),
  md: v('shadow-md'),
  lg: v('shadow-lg'),
  focus: v('shadow-focus'),
} as const;

export const motion = {
  duration: {
    instant: v('motion-duration-instant'),
    fast: v('motion-duration-fast'),
    base: v('motion-duration-base'),
    slow: v('motion-duration-slow'),
    counter: v('motion-duration-counter'),
    gallery: v('motion-duration-gallery'),
    toastOut: v('motion-duration-toast-out'),
  },
  ease: {
    standard: v('motion-ease-standard'),
    emphasis: v('motion-ease-emphasis'),
    exit: v('motion-ease-exit'),
    linear: v('motion-ease-linear'),
  },
} as const;

export const zIndex = {
  base: v('z-base'),
  sticky: v('z-sticky'),
  overlayLow: v('z-overlay-low'),
  overlayMid: v('z-overlay-mid'),
  overlayHigh: v('z-overlay-high'),
  toast: v('z-toast'),
} as const;

export const breakpoint = {
  sm: v('breakpoint-sm'),
  md: v('breakpoint-md'),
  lg: v('breakpoint-lg'),
  xl: v('breakpoint-xl'),
  '2xl': v('breakpoint-2xl'),
  '3xl': v('breakpoint-3xl'),
} as const;

/** Aggregate of every token group — the single object the drift test walks. */
export const tokens = {
  colour,
  fontFamily,
  fontWeight,
  type,
  space,
  size,
  ratio,
  radius,
  shadow,
  motion,
  zIndex,
  breakpoint,
} as const;

export type Tokens = typeof tokens;
