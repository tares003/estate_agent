# EPIC-M — UX and visual design system

**Master spec reference:** Section M.
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-M-design-system.md](../../design-briefs/v1/EPIC-M-design-system.md).

## Purpose

Implement the runtime layer that exposes every design token to consuming components — the tokens package, theme accessor, and per-tenant theme override mechanism.

## Functional requirements

- **FR-M-1.** Every token defined in `DESIGN.md` shall be exposed at runtime as a CSS custom property and as a typed accessor in the shared `tokens` package.
- **FR-M-2.** A tenant administrator shall be able to override the brand-primary, brand-accent, brand-primary-on, brand-accent-on, logo, font-display and font-body tokens via the admin theme editor (master spec Section H.11). Other tokens shall not be tenant-overridable.
- **FR-M-3.** Theme overrides shall be applied without a rebuild and shall propagate to every consumer within seconds.
- **FR-M-4.** Theme overrides shall not be allowed to violate accessibility contrast minimums per `design-requirements.md` section 1. The platform shall warn the editor when a chosen override fails contrast and shall require explicit override.
- **FR-M-5.** Every motion token defined in `motion-spec.md` shall be exposed as a duration value and an easing value at runtime.
- **FR-M-6.** Every typography token shall map to a configurable web-font face (per `DESIGN.md` section 3). Font preloading shall respect the configured weights.
- **FR-M-7.** The reduced-motion fallback (per `motion-spec.md` section 5) shall be applied universally when the user's environment requests it.

## Acceptance criteria

- A theme change applied in the admin reflects on every public surface within seconds without a build step.
- An attempted theme override that breaks accessibility contrast is flagged in the editor.
- Every token is referenced through the accessor or CSS variable — no hardcoded values pass CI lint.
- Reduced-motion environment renders all components without non-essential animation.

## Test mapping

```
FR-M-1 → tests/unit/tokens-package.test.*
FR-M-2 → tests/integration/theme-override.test.*
FR-M-3 → tests/e2e/theme-propagation.spec.*
FR-M-4 → tests/integration/theme-contrast-validator.test.*
FR-M-5 → tests/unit/motion-tokens.test.*
FR-M-6 → tests/integration/typography-tokens.test.*
FR-M-7 → tests/integration/reduced-motion.test.*
```

## Dependencies

- `DESIGN.md`, `motion-spec.md`, `design-requirements.md` as inputs.
- EPIC-H — the theme editor surface.

## Open questions

1. Confirm the contrast minimum thresholds enforced at theme save (AA at 4.5:1 vs AAA at 7:1).
2. Confirm whether a per-tenant typography override is included in V1 (recommended: optional, behind a feature flag).
3. Confirm the font-loading strategy (preload one woff2 per family, swap fallback).
