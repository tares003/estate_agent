# EPIC-L — Frontend components

**Master spec reference:** Section L (L.1–L.8).
**Pack:** Core.
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-L-frontend-components.md](../../design-briefs/v1/EPIC-L-frontend-components.md).

## Purpose

Implement the shared component library that every shell consumes: atoms, molecules, organisms across public site, customer account and admin. Components consume tokens from EPIC-M and types from EPIC-J.

## Functional requirements

- **FR-L-1.** Every component listed in master spec Section L shall exist in the shared UI package with documented prop API.
- **FR-L-2.** Every component shall expose `loading`, `empty`, `error` and `success` states where applicable (per `design-requirements.md` section 7).
- **FR-L-3.** Every interactive component shall satisfy accessibility requirements per `design-requirements.md` section 1 (keyboard reach, focus indicator, label association, ARIA roles).
- **FR-L-4.** Every component shall consume tokens from the shared `tokens` package — never inline hex, px, ms or easing values.
- **FR-L-5.** Every component shall respect `prefers-reduced-motion` per `motion-spec.md` section 5.
- **FR-L-6.** Every component shall have a Storybook-equivalent or equivalent visual documentation entry showing every variant.
- **FR-L-7.** The PropertyCard component shall render every variant (sale, rent, sold STC, sold, under offer, let agreed, let, new home, withdrawn) per the status colour tokens.
- **FR-L-8.** Form atoms (TextField, EmailField, PhoneField, NumberField, Select, Combobox, DatePicker, TimeSlotSelector, Checkbox, Radio, FileDropzone) shall expose a consistent validation-error display, an `aria-describedby` link to error text, and a focus-visible focus ring.
- **FR-L-9.** Layout primitives (Header, Footer, MobileMenu, StickyValuationCTA, ReviewsBadge) shall render their content from CMS configuration without recompile.
- **FR-L-10.** The AntiSpamChallenge component shall expose a uniform interface regardless of the underlying anti-spam provider (token capture + server-side verification).

## Acceptance criteria

- Every component has at least one component test (asserting accessibility, prop variants, state transitions).
- Every component has at least one visual baseline.
- Tokens are referenced, not hardcoded — verified by the design-token CI guard.
- Reduced-motion behaviour is verified per component.
- The PropertyCard renders correctly for every market_status variant.

## Test mapping

```
FR-L-1 → tests/component/<component>.test.* (one per component)
FR-L-2 → tests/component/<component>-states.test.*
FR-L-3 → tests/a11y/<component>.spec.*
FR-L-4 → automatic — verified by CI design-token guard
FR-L-5 → tests/component/<component>-reduced-motion.test.*
FR-L-6 → automatic — verified by visual regression suite presence
FR-L-7 → tests/component/property-card-variants.test.*
FR-L-8 → tests/component/form-atoms.test.*
FR-L-9 → tests/component/layout-primitives.test.*
FR-L-10 → tests/component/anti-spam-challenge.test.*
```

## Dependencies

- EPIC-M — tokens and theming runtime.
- EPIC-J — types referenced in component props.

## Open questions

1. Confirm the Storybook-equivalent choice (this is the closest piece of "tooling" the brief allows; defer until the stack is chosen).
2. Confirm whether dark mode is in V1 (recommended: deferred).
3. Confirm whether per-tenant component overrides are in V1 (recommended: no — tenants customise via theme tokens only).
