# @estate/ui-components

First-party React component library — the **EPIC-L primitives ported from `design/canvas/`**. No third-party UI kit (preserves design fidelity per guard G7).

## Scope (EPIC-L atoms + molecules + key organisms)

- **Atoms:** Button, TextField, EmailField, PhoneField, NumberField, Select, Combobox, DatePicker, TimeSlotSelector, Checkbox, Radio, Modal, Drawer, Toast, Tooltip, Popover, Dropdown, Tabs, Accordion, Skeleton, Avatar, Badge, Icon, Pagination, Breadcrumbs, AntiSpamChallenge (Turnstile), FileDropzone, MultiStepForm, FormReviewSummary, FormError, FormSuccess.
- **Modular/pack-state organisms:** `PackLockPill`, `UpsellEmptyState`, `TrialCountdownPill`, `PackEnableModal`.
- **Universal organism:** `PropertyCard` (all nine `market_status` variants).
- **Four state patterns:** empty / loading / error / success (from `design/canvas/states/`).

## Build contract

Each component is built **test-first against its canvas artefact** (`design/canvas/components/...`) and verified:

- **Visual regression** at all 7 breakpoints, mirroring `design/canvas/responsive-coverage.json` (guard G11).
- **Accessibility** — focus management, label association, keyboard reach, ≥44px touch targets (guard G9); no hover-only interactions.
- **Tokens only** — no raw hex/px/ms (guard G7); all values from `@estate/tokens`.

Coverage gate: **90% line / 80% branch** (UI primitives).

Status: **skeleton** — built in Phase B1 (EPIC-L + EPIC-M).
