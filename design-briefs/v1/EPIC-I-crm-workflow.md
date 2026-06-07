# EPIC-I — CRM and lead workflow (design)

**Dev brief:** [dev-briefs/v1/EPIC-I-crm-workflow.md](../../dev-briefs/v1/EPIC-I-crm-workflow.md).
**Master spec reference:** Section I.
**Pack:** Core.
**Status:** NOT_STARTED.

## Surfaces affected

- Lead queue (admin).
- Lead detail slide-over.
- Assignment-rules editor.
- SLA configuration screen.
- CRM reports.

## Layout patterns

### Lead queue

- Tab strip at top: All / Mine / Unassigned / Overdue follow-up / Closed.
- Filter bar with chips for active filters.
- Saved-view dropdown.
- Table with columns: status badge / priority chip / lead type / name / property / source / assigned / age / last activity / follow-up date.
- Age column colour-coded: green ≤ 4 h, amber ≤ 24 h, red > 24 h.
- Row click opens slide-over; double-click opens full detail page.

### Lead detail slide-over (quick triage)

- Header: name, contact, status, priority, assign-to.
- Activity timeline (compact).
- Compose box.
- Right-rail: property card, source attribution, GDPR consent indicator.

### Lead detail full page

- Wider activity timeline.
- More extensive composer with template picker.
- Linked records (viewing requests, valuation requests, contacts) listed.
- Conversion controls visible.

### Assignment-rules editor

- Sortable rule list.
- Each rule: `IF <conditions> THEN <assignment>` displayed as readable English with edit affordance.
- "Test rule" panel: paste a sample lead, see which rule fires.

## Component inventory

`AdminTable`, `Drawer` (slide-over), `ActivityFeed`, `StatusBadge`, `PriorityChip`, `Combobox`, `DatePicker`, plus a new `RuleEditor` organism for the assignment-rules screen.

## State variations

- **Empty queue:** "Your inbox is empty" message with subdued illustration.
- **Filtered to zero:** "No leads match these filters" with "Clear filters" CTA.
- **Loading detail:** skeleton matching final layout.
- **Reply send error:** inline error within composer.
- **Conversion conflict:** if conversion target already exists, show a conflict dialog with "Merge / Create new" options.

## Accessibility specifics

- Status badge has `aria-label`.
- Priority chip has `aria-label` describing severity.
- Composer is a labelled `region`.
- Slide-over has focus trap; Esc closes and restores focus to the row.

## Responsive

- Queue table converts to stacked cards below `--breakpoint-md`.
- Slide-over becomes full-screen on mobile.

## Motion

- Slide-over open / close: `--motion-duration-base`.
- New-lead row appearance: gentle fade-in over `--motion-duration-fast` only when the queue is in a "live updates" state; otherwise no animation.

## Token references

- Priority chips use `--colour-priority-*`.
- Status badges use `--colour-status-*` (lead-status palette, distinct from market-status palette).
- Age-column colours: `--colour-success` / `--colour-warning` / `--colour-danger`.

## Open design questions

1. Confirm the slide-over width (recommended: 480 px desktop).
2. Confirm whether the rule editor uses a visual flow-chart metaphor or a stacked-statement metaphor.
3. Confirm the composer template-picker placement (inline above body vs slide-out panel).

## Pack-state behaviour

Per `design-requirements.md` §2a — the CRM queue reflects pack state at the lead-type level:

- **Lead-type filter dropdown**: only lead types corresponding to enabled packs appear. `developer_enquiry` only shown with `new_homes`; `commercial_enquiry` only with `commercial`; `business_enquiry` only with `business_transfer`.
- **Lead-type tabs / saved views**: the seeded saved views ("Unassigned vendor enquiries", "Repair tickets by SLA") are filtered to enabled packs.
- **Assignment rules editor**: conditions that reference pack-gated lead types appear with a `PackLockPill`.
- **CRM reports** (lead conversion by source, by agent, by branch): metric definitions remain stable across packs; counts naturally reflect which lead types are receivable.
