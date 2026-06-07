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
4. **Responsive variations at every breakpoint defined in `DESIGN.md` §10 — 320, 640, 768, 1024, 1280, 1440 and 2560 px** (mandate from `design-requirements.md` §0).
5. Reduced-motion variation.
6. Dark-mode variation (if dark mode is in scope; otherwise deferred).
7. Accessibility annotations: focus management, label association, ARIA roles, keyboard support.
8. Token references — every colour, spacing, size, motion value annotated with its token.

## Responsive

Every component in this library is **responsive by default** — there is no "desktop component" vs "mobile component" split, only one component that adapts. The canvas entries above are the contract: a component with a missing breakpoint variant is incomplete and will not pass the responsive-coverage CI guard.

- Mobile-first markup: default styles target 320 px; media queries