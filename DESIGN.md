# DESIGN — Design tokens

This document is the authority for **the named values every visual decision must reference**. Tokens are framework-neutral: a number, a colour, a duration, a length, a unit-less ratio, a label. They are intended to be exposed as CSS custom properties at runtime and aliased into whatever styling system the chosen implementation uses.

## 1. Token naming convention

- Token names are lowercase, dash-separated.
- The format is `--{category}-{name}[-{variant}]`.
- Categories: `colour`, `text`, `font`, `space`, `size`, `radius`, `shadow`, `motion`, `z`, `breakpoint`, `ratio`, `weight`.
- Never use a raw value (hex, px, ms, fr) in code when a token applies. CI lint enforces this.

## 2. Colour tokens

The example values below are the working palette — confirm with the design canvas before launch. They illustrate a warm-dark-editorial direction; adjust the actual hexes when the brand position is locked.

### Brand

| Token | Example value | Used for |
|---|---|---|
| `--colour-brand-primary` | `#1F2937` | Primary buttons, header background, key emphasis |
| `--colour-brand-primary-hover` | `#111827` | Hover state of primary brand surfaces |
| `--colour-brand-primary-on` | `#FFFFFF` | Text on brand-primary background |
| `--colour-brand-accent` | `#C9A24B` | Focus rings, accents, hover underlines, link emphasis |
| `--colour-brand-accent-hover` | `#B0892F` | Hover of accent surfaces |
| `--colour-brand-accent-on` | `#1A1A1A` | Text on brand-accent background |

### Text

| Token | Example value | Used for |
|---|---|---|
| `--colour-text-primary` | `#1A1A1A` | Default body and heading text |
| `--colour-text-secondary` | `#4B5563` | Supporting text, descriptions |
| `--colour-text-muted` | `#6B7280` | Tertiary text, metadata, labels |
| `--colour-text-on-dark` | `#F9FAFB` | Text on any dark background |
| `--colour-text-inverse` | `#FFFFFF` | High-contrast text on full-bleed dark imagery |

### Surface

| Token | Example value | Used for |
|---|---|---|
| `--colour-surface-base` | `#FFFFFF` | Default page background, card surface |
| `--colour-surface-raised` | `#F8F7F4` | Subtle elevation — section backgrounds, card hover, banners |
| `--colour-surface-sunken` | `#EFEDE6` | Disabled fields, code, quiet emphasis |
| `--colour-border` | `#E5E2DA` | Default borders on cards, inputs, dividers in editorial content |
| `--colour-divider` | `#E5E7EB` | Hairline dividers within forms and tables |

### Property market status

These map 1:1 to `market_status` values; the badge component reads them.

| Token | Example value | Status |
|---|---|---|
| `--colour-status-available` | `#10B981` | Available (For Sale / To Rent) |
| `--colour-status-under-offer` | `#F59E0B` | Under offer |
| `--colour-status-sold-stc` | `#EF4444` | Sold STC |
| `--colour-status-sold` | `#6B7280` | Sold |
| `--colour-status-let-agreed` | `#F59E0B` | Let agreed |
| `--colour-status-let` | `#6B7280` | Let |
| `--colour-status-withdrawn` | `#9CA3AF` | Withdrawn |

### Repair / lead priority

| Token | Example value | Priority |
|---|---|---|
| `--colour-priority-emergency` | `#DC2626` | Emergency repair, urgent lead |
| `--colour-priority-urgent` | `#F59E0B` | Urgent |
| `--colour-priority-standard` | `#3B82F6` | Standard / normal |
| `--colour-priority-low` | `#6B7280` | Non-urgent / low |

### Semantic

| Token | Example value | Used for |
|---|---|---|
| `--colour-success` | `#10B981` | Successful state, confirmation, "saved" indicators |
| `--colour-warning` | `#F59E0B` | Warning state, near-SLA breach, expiring compliance items |
| `--colour-danger` | `#EF4444` | Destructive action, error state, breached SLA |
| `--colour-info` | `#3B82F6` | Informational toast, neutral notification |

### Focus and selection

| Token | Example value | Used for |
|---|---|---|
| `--colour-focus-ring` | `rgba(201, 162, 75, 0.45)` | Universal focus ring (built on brand accent) |
| `--colour-selection` | `rgba(201, 162, 75, 0.2)` | Text selection background |

## 3. Typography tokens

The recommended type pairing is a contemporary serif for display, a neutral sans for body. The example families below are illustrative; confirm with the design canvas. Token names persist regardless of the chosen family.

### Font families

| Token | Example value |
|---|---|
| `--font-display` | `"Fraunces", "Cormorant Garamond", "Playfair Display", Georgia, serif` |
| `--font-body` | `"Inter", "Helvetica Neue", system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` |

### Type scale

| Token | Size / line-height | Letter-spacing | Weight token | Typical use |
|---|---|---|---|---|
| `--text-display-xl` | 72 / 76 | -0.03em | `--weight-regular` | Hero on portal homepage |
| `--text-display-lg` | 56 / 60 | -0.025em | `--weight-regular` | Vertical landing hero |
| `--text-display-md` | 40 / 44 | -0.02em | `--weight-regular` | Section openers |
| `--text-display-sm` | 32 / 36 | -0.015em | `--weight-regular` | Block headings on landing pages |
| `--text-heading-lg` | 28 / 32 | 0 | `--weight-semibold` | Page titles in app surfaces |
| `--text-heading-md` | 22 / 28 | 0 | `--weight-semibold` | Section heads inside pages |
| `--text-heading-sm` | 18 / 24 | 0 | `--weight-semibold` | Card titles, table groupings |
| `--text-body-lg` | 18 / 28 | 0 | `--weight-regular` | Long-form reading |
| `--text-body-md` | 16 / 24 | 0 | `--weight-regular` | Default body |
| `--text-body-sm` | 14 / 20 | 0 | `--weight-regular` | Supporting body, table cells |
| `--text-caption` | 12 / 16 | 0.08em uppercase | `--weight-semibold` | Status pills, eyebrows, meta labels |

### Weights

| Token | Numerical value |
|---|---|
| `--weight-light` | 300 |
| `--weight-regular` | 400 |
| `--weight-medium` | 500 |
| `--weight-semibold` | 600 |
| `--weight-bold` | 700 |

## 4. Spacing tokens

A 4px base scale, expressed as multipliers. All padding, margin, and gap values must reference one of these.

| Token | Pixel equivalent |
|---|---|
| `--space-0` | 0 |
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 20 |
| `--space-6` | 24 |
| `--space-8` | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |
| `--space-20` | 80 |
| `--space-24` | 96 |
| `--space-32` | 128 |

## 5. Size tokens

For component dimensions, container widths, image ratios.

### Container widths

| Token | Pixel value |
|---|---|
| `--size-container-sm` | 640 |
| `--size-container-md` | 768 |
| `--size-container-lg` | 1024 |
| `--size-container-xl` | 1280 |
| `--size-container-2xl` | 1440 |

### Component sizes

| Token | Pixel value | Used for |
|---|---|---|
| `--size-button-sm` | 36 | Small button height |
| `--size-button-md` | 44 | Default button height (meets touch-target minimum) |
| `--size-button-lg` | 52 | Large CTA height |
| `--size-input-md` | 48 | Default input height |
| `--size-icon-sm` | 16 | Property facts row |
| `--size-icon-md` | 18 | Navigation, buttons |
| `--size-icon-lg` | 20 | Default icon size |
| `--size-icon-xl` | 32 | Hero callouts |
| `--size-touch-target-min` | 44 | Minimum touch-target dimension |

### Image ratios

| Token | Ratio | Used for |
|---|---|---|
| `--ratio-card` | 4 / 3 | Property card image |
| `--ratio-hero` | 16 / 9 | Hero banner image / video |
| `--ratio-avatar` | 1 / 1 | Team photos, testimonial avatars |
| `--ratio-floorplan` | 1 / 1 | Floorplan tile preview |

## 6. Radius tokens

| Token | Pixel value | Used for |
|---|---|---|
| `--radius-sm` | 4 | Status pills, small chips |
| `--radius-md` | 8 | Buttons, inputs, property cards |
| `--radius-lg` | 12 | Card containers, modals |
| `--radius-xl` | 16 | Hero panels, large CTA cards |
| `--radius-pill` | 9999 | Full pill shape (status badges, filter chips) |
| `--radius-circle` | 50% | Avatars |

## 7. Shadow tokens

| Token | Used for |
|---|---|
| `--shadow-xs` | Subtle elevation on hover of small surfaces |
| `--shadow-sm` | Default card hover, dropdown menus |
| `--shadow-md` | Modal, popover, sticky bar |
| `--shadow-lg` | Lightbox, fullscreen overlay |
| `--shadow-focus` | Focus ring (combined with `--colour-focus-ring`) |

Concrete shadow values are defined in `motion-spec.md` (companion document) because they relate to elevation behaviour.

## 8. Motion tokens

Detailed motion specification is in `motion-spec.md`. Token names from there are summarised here for reference:

| Token | Used for |
|---|---|
| `--motion-duration-fast` | Hover transitions |
| `--motion-duration-base` | Modal in/out, dropdown reveal |
| `--motion-duration-slow` | Counter animation, hero parallax (where allowed) |
| `--motion-ease-standard` | Default ease for in/out |
| `--motion-ease-emphasis` | Slight overshoot for celebratory states |
| `--motion-ease-exit` | Faster ease for elements leaving the viewport |

## 9. Z-index tokens

To avoid stacking-context fights, every absolutely or fixed-positioned element must reference one of these.

| Token | Used for |
|---|---|
| `--z-base` | Default flow |
| `--z-sticky` | Sticky utility bar, sticky header on scroll |
| `--z-overlay-low` | Dropdown menus, popovers |
| `--z-overlay-mid` | Modal, drawer |
| `--z-overlay-high` | Lightbox, full-screen takeover |
| `--z-toast` | Toast notifications |

## 10. Breakpoint tokens

| Token | Pixel value | Range |
|---|---|---|
| `--breakpoint-sm` | 640 | Phone landscape and up |
| `--breakpoint-md` | 768 | Tablet portrait and up |
| `--breakpoint-lg` | 1024 | Tablet landscape / small desktop |
| `--breakpoint-xl` | 1280 | Standard desktop |
| `--breakpoint-2xl` | 1440 | Wide desktop |

## 11. Token enforcement

The CI lint described in `dev-briefs/sprint-01/_cross-cutting.md` rejects any code change that:

- Hardcodes a hex colour that maps to a colour token.
- Hardcodes a pixel value that maps to a space, size or radius token.
- Hardcodes a motion duration that maps to a motion-duration token.
- Defines a new colour, size or motion value not present in this document without an accompanying amendment to this document.

## 12. Theme overrides

Each agency tenant may override the brand-primary, brand-accent, brand-primary-on, brand-accent-on, logo, font-display and font-body tokens through the admin's theme editor (see master spec Section H.11). Other tokens are not tenant-overridable to preserve usability and accessibility.

## 13. Amendment

Token additions are PRs against this document. Token removals require a documented migration plan, because removing a token may break tenant theme overrides.
