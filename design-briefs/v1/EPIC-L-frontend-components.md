# EPIC-L — Frontend components (design)

**Dev brief:** [dev-briefs/v1/EPIC-L-frontend-components.md](../../dev-briefs/v1/EPIC-L-frontend-components.md).
**Master spec reference:** Section L.
**Pack:** Core.
**Status:** NOT_STARTED.

## Purpose

Define every component in the canvas — every atom, every molecule, every organism — with every variant, every state, every responsive behaviour and every accessibility property documented. The canvas is the visual source of truth that paired component tests assert against.

## Component inventory

### Atoms

`Button` (primary / secondary / ghost / destructive / link × sm / md / lg), `TextField`, `EmailField`, `PhoneField`, `NumberField`, `TextArea`, `Select`, `Combobox`, `DatePicker`, `TimeSlotSelector`, `PriceRangeSlider`, `Checkbox`, `Radio`, `Switch`, `Avatar`, `Badge`, `Pill`, `Icon`, `Skeleton`, `Tag`, `Caption`.

### Molecules

`Card`, `Modal`, `Drawer`, `Toast`, `Tooltip`, `Popover`, `Dropdown`, `Tabs`, `Accordion`, `Pagination`, `Breadcrumbs`, `FormError`, `FormSuccess`, `EmptyState`, `Stepper`, `FileDropzone`, `AntiSpamChallenge`, `MultiStepForm`, `FormReviewSummary`.

### Layout / Shell

`Header`, `MobileMenu`, `Footer`, `StickyValuationCTA`, `ReviewsBadge`, `CookieBanner`, `AdminSidebar`, `AdminTopbar`, `AdminBreadcrumbs`.

### Modular product (pack-state) — new in this pass

`PackLockPill`, `UpsellEmptyState`, `TrialCountdownPill`, `PackEnableModal` (consumed from EPIC-AD's design but the component lives in the shared library).

These four components are referenced by every pack-gated surface across the product (see `design-requirements.md` §2a for the universal pack-state patterns). The first two are the most heavily reused:

- **`PackLockPill`** — a small badge attached to any element that is pack-gated. Variants: inline (next to a control or list item), corner (top-right of a card), full-row (in a list). Accessible name: "Requires [Pack-name] pack". Click / activate opens the pack-enable modal. Used in: page-builder section catalogue, form-builder field palette, notification-rule event picker, automation-rule trigger picker, property-editor attribute group affordances, lead-type filter dropdowns, customer-portal links in the public site.

- **`UpsellEmptyState`** — the "locked admin section" pattern. Used in place of a 404 when a tenant operator navigates to an admin section whose owning pack is off. Includes pack name, what it enables, illustration slot, monthly cost, primary "Enable" CTA opening the pack-enable modal, secondary "Learn more" link. Variants: full-screen (when the entire section is locked), inline (when a sub-section within an otherwise-enabled section is locked).

- **`TrialCountdownPill`** — a small status pill rendered at the top-right of any screen contributing to a pack on trial. Colour shifts at ≤ 3 days (`--colour-warning`) and ≤ 1 day (`--colour