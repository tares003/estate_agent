# @estate/ui

The first-party React component library. Every atom, molecule, organism, and pack-state primitive from EPIC-L is ported here from `design/canvas/`.

## Source of truth

`design/canvas/` — the static HTML + CSS produced by the design Claude. Every component in this package mirrors a canvas artefact one-for-one, preserving the exact class names, structure, and responsive behaviour at all 7 breakpoints.

## What lives here

- **Atoms** — Button, Input, Select, Checkbox, Radio, Pill, Badge, IconButton, Skeleton, Spinner, Avatar.
- **Molecules** — FormField, SearchInput, Card, Toast, Tooltip, Modal, Popover, Tabs.
- **Organisms** — DataTable, Calendar, GalleryViewer, FilterSidebar, CommandPalette, Drawer.
- **Pack-state primitives** (EPIC-AD) — `PackLockPill`, `UpsellEmptyState`.
- **Map primitive** — `<Map>` component with the `MapBackend` interface; runtime-selected Google Maps or Mapbox per the tenant's configured key.
- **Responsive variants** — every component is tested at all 7 breakpoints (G11).

## What does NOT live here

- Application-specific components (those live in `apps/web/components/`).
- Payload CMS block components (those live in `apps/web/payload/blocks/<name>/render.tsx`).
- Server Actions or data-fetching logic.

## Discipline

Every component ships test-first against its canvas artefact: a visual-regression screenshot at all 7 breakpoints, a Vitest unit test for interactive behaviour, an axe-core a11y test. Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B1 (EPIC-L).
