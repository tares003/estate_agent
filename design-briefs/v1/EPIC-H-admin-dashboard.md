# EPIC-H — Admin dashboard (design)

**Dev brief:** [dev-briefs/v1/EPIC-H-admin-dashboard.md](../../dev-briefs/v1/EPIC-H-admin-dashboard.md).
**Master spec reference:** Section H (H.1–H.28).
**Pack:** Core (with pack-dependent admin sections gated).
**Status:** NOT_STARTED.

## Surfaces affected

The full admin shell — 28 sub-areas listed in master spec Section H. Designs are produced incrementally across sprints; this brief carries the universal admin patterns and identifies which screens are V1.

## V1 admin screens

- Dashboard overview (H.4).
- Property list and editor (H.5).
- Lead queue and detail (H.6).
- Calendar (H.7).
- Repair inbox and detail (H.8 — covered by EPIC-G).
- Contacts (H.9).
- Page builder (H.10 — covered by EPIC-D).
- Theme editor (H.11 — covered by EPIC-M).
- Email and SMS template editors (H.12).
- Notification rules matrix (H.13).
- Users and roles (H.17).
- Settings hierarchy (H.19).
- Audit log viewer (H.20).
- Reports (H.21).
- Scheduled tasks console (H.23).
- Search admin (H.25).
- Keyboard shortcuts + command palette (H.27, H.28).

## Universal admin patterns

### Shell

- **Sidebar:** collapsible. 240 px expanded, 64 px collapsed. Brand mark at top, primary nav, divider, secondary nav.
- **Topbar:** breadcrumbs, global search, notifications, profile menu. 56 px height.
- **Content area:** 24 px outer padding desktop, 16 px mobile.

### Table view

- Sortable columns with visible sort indicator.
- Multi-select via row checkbox; bulk-action bar appears when ≥ 1 selected.
- Density toggle: compact / comfortable / spacious.
- Column-visibility menu with drag-to-reorder.
- Pagination: first / prev / numbered / next / last + "showing X of Y".
- Saved-view dropdown above the table.

### Form view

- Tabbed multi-step forms (e.g. the 9-tab property editor).
- Sticky bottom action bar: Save Draft / Save / Cancel / context-specific actions.
- Field groups visually separated by 32 px gap.
- Validation errors inline + a summary at top when more than three errors.

### Empty state

- Centred illustration (CMS-managed or token-driven SVG) + 1-line message + primary CTA.

### Loading state

- Skeleton matching the final layout — no spinners on data surfaces.

### Error state

- Inline retry. Modal explanation only for catastrophic errors.

### Success state

- Toast in the top-right corner that auto-dismisses after 5 s.

## Component inventory

`AdminSidebar`, `AdminTopbar`, `AdminBreadcrumbs`, `AdminDashboardCards`, `AdminTable`, `AdminForm`, `AdminImageManager`, `AdminFileUpload`, `StatusBadge`, `NotificationPanel`, `RichTextEditor`, `PageBuilder`, `CalendarView`, `ActivityFeed`, plus every shared primitive from EPIC-L.

## Accessibility specifics

- Sidebar is keyboard-navigable; collapsed state retains the tooltips on focus.
- The command palette (`Cmd/Ctrl+K`) is fully keyboard-driven, has visible focus on each item, and reads the selected item via `aria-activedescendant`.
- The notifications panel is a `region` with `aria-live="polite"` for new entries.
- Every data-table cell announces its column header for screen-reader users.

## Responsive behaviour

- Sidebar collapses to icon-only at `--breakpoint-lg` and below.
- Sidebar becomes a hamburger drawer below `--breakpoint-md`.
- Tables convert to stacked cards below `--breakpoint-md`.

## Motion

- Sidebar collapse / expand: `--motion-duration-base` `--motion-ease-standard`.
- Slide-over open / close: `--motion-duration-base`.
- Toast in / out: per `motion-spec.md` toast rules.
- No animation on table-row hover (reserved for cards).

## Token references

Admin surfaces use:

- `--colour-surface-base` for content, `--colour-surface-sunken` for the sidebar.
- `--colour-border` for table dividers.
- `--radius-md` for buttons and inputs, `--radius-lg` for cards.
- `--space-6` for default content padding.

## Open design questions

1. Confirm the dashboard overview's primary widget layout (4 + 3 + sidebar vs flexible per role).
2. Confirm the table density default (recommended: comfortable).
3. Confirm the visual treatment of the command palette (centred modal with backdrop vs slim top-anchored).
4. Confirm the impersonation visual indicator (banner, ribbon, sidebar tag).
