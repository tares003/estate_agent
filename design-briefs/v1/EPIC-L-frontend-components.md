# EPIC-L — Frontend components (design)

**Dev brief:** [dev-briefs/v1/EPIC-L-frontend-components.md](../../dev-briefs/v1/EPIC-L-frontend-components.md).
**Master spec reference:** Section L.
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

### Organisms (referenced from feature epics)

`PropertyCard`, `PropertyGrid`, `PropertyCarousel`, `PropertyHero`, `PropertyGallery`, `PropertyFactsStrip`, `PropertyMap`, `AgentCard`, `TeamGrid`, `BranchCard`, `TestimonialsCarousel`, `FAQAccordion`, `PartnerLogosRow`, `CTAStrip`, `BookViewingForm`, `ContactAgentModal`, `RegistrationBanner`, `RichTextEditor`, `PageBuilder`, `AdminTable`, `AdminForm`, `AdminImageManager`, `AdminFileUpload`, `StatusBadge`, `NotificationPanel`, `CalendarView`, `ActivityFeed`.

## Per-component documentation requirement

Each component's canvas entry must show:

1. Every prop variant.
2. Default, hover, focus, active, disabled and loading states.
3. Empty, error and success states where applicable.
4. Responsive variations at every breakpoint defined in `DESIGN.md`.
5. Reduced-motion variation.
6. Dark-mode variation (if dark mode is in scope; otherwise deferred).
7. Accessibility annotations: focus management, label association, ARIA roles, keyboard support.
8. Token references — every colour, spacing, size, motion value annotated with its token.

## Acceptance for the design library

- Every component in the inventory has an approved canvas entry.
- Every variant and state is documented.
- A second designer has reviewed and signed off.
- The implementation team can build any component without further clarification.

## Open design questions

1. Confirm the family of icons (single-style line set vs duotone vs custom).
2. Confirm whether `Switch` is included in V1 (recommended: yes).
3. Confirm dark-mode scope (recommended: deferred).
