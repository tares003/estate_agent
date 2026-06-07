# EPIC-AA — Tenant portal (design)

**Dev brief:** [dev-briefs/v1/EPIC-AA-tenant-portal.md](../../dev-briefs/v1/EPIC-AA-tenant-portal.md).
**Status:** NOT_STARTED.

## Surfaces affected

- `/tenant/sign-in` (magic-link).
- `/tenant` (tenancy dashboard).
- `/tenant/rent` (rent status + history + link out to payment).
- `/tenant/repairs` (open tickets + raise-new form).
- `/tenant/inspections`.
- `/tenant/documents` (deposit certificate, EPC, gas safety, How-To-Rent, EICR).
- `/tenant/messages`.
- `/tenant/renewal` (within 60 days of tenancy end).
- `/tenant/end-of-tenancy` (when notice given).
- `/tenant/profile`.

## Layout patterns

### Tenancy dashboard

- Hero strip: property address, tenancy month-N indicator, monthly rent, next rent due date, deposit reference.
- KPI tiles: This month's rent status (paid / due in N days), Open repair tickets, Days until tenancy end (or "Rolling").
- Quick actions: Raise a repair / Pay rent / Message property manager.
- Activity feed (last 10 items).

### Rent screen

- Headline: "Your next rent of £X is due on [date]".
- Status pill: paid / due / overdue.
- Primary action: "Pay rent" (deep link to external rent-collection product).
- 12-month history table: month, amount due, amount paid, date paid, status.

### Repairs screen

- Open tickets list with status badges, last update.
- Prominent "Raise a new repair" CTA that deep-links to the EPIC-G form pre-filled.

### Inspections screen

- Chronological list: scheduled inspections at top, past inspections below.
- Each row: date, inspection type, status, outcome notes (collapsible), shared photos.

### Documents screen

- Card grid: Deposit protection certificate, Tenancy agreement, EPC, Gas safety, EICR, How-To-Rent guide.
- Each card: type icon, last updated, download CTA.

### Renewal panel (within 60 days)

- "Your tenancy ends on [date]" prompt.
- If agency has proposed renewal terms: clear summary, Accept / Decline / Counter actions.
- "Give notice" link to the end-of-tenancy flow.

### End-of-tenancy checklist

- Multi-step form: confirm notice date and intended departure → forwarding address → deposit return preferences (return in full / dispute / partial dispute) → cleaning checklist acknowledgement → meter readings (date and value).
- Save progress at each step.

## Component inventory

`TenantSignInPage`, `TenantDashboard`, `TenantRentStatusCard`, `TenantRentHistoryTable`, `TenantOpenRepairsList`, `TenantRaiseRepairCTA`, `TenantInspectionsList`, `TenantDocumentsGrid`, `TenantMessagesThread`, `TenantRenewalPanel`, `TenantEndOfTenancyChecklist`, `TenantProfileForm`. Built on EPIC-L primitives.

## State variations

- **Rent overdue:** prominent red banner with "Your rent is X days overdue. Please pay today or contact us." with action.
- **No open repairs:** "All clear — no open repair tickets" with a "Need to raise a repair?" link.
- **No upcoming inspection:** "No inspections scheduled. You'll be notified by email when one is."
- **Rolling tenancy (no fixed end date):** renewal panel shows "Your tenancy is rolling monthly — we'll be in touch if anything changes."
- **Notice given:** renewal panel hidden; end-of-tenancy checklist becomes the primary CTA on the dashboard.
- **Post-tenancy (within 90 days of end):** read-only banner across all screens "This is a read-only view. Your tenancy ended on [date]."
- **Post-tenancy beyond 90 days:** account disabled, sign-in shows "Your portal access has ended" with a Subject Access Request CTA.

## Accessibility specifics

- Rent due date in the headline carries an `aria-label` ("Next rent of £1,200 is due on 1 December — 14 days away").
- Status pills have `aria-label` carrying full status name.
- End-of-tenancy checklist uses real form controls with proper grouping.
- Document download CTAs include format and size ("PDF, 2.4 MB") in their accessible name.

## Responsive

- Tenancy dashboard quick actions stack vertically on mobile.
- Rent screen pivots to a card list below `--breakpoint-md`.
- Documents grid: 3 wide desktop, 2 tablet, 1 mobile.
- End-of-tenancy checklist: full-screen wizard on mobile.

## Motion

- Rent-due banner subtle pulse when overdue — disabled under reduced motion.
- Repair status changes trigger toast notifications per standard rules.
- Document downloads use a brief "Preparing your download…" inline state.

## Token references

- Rent overdue: `--colour-danger`.
- Rent due soon (within 7 days): `--colour-warning`.
- Rent up to date: `--colour-success`.
- Document card hover: `--shadow-sm`.

## Open design questions

1. Confirm whether the tenancy dashboard shows the deposit balance (full vs partially-claimed) — recommended: full lodged amount with reference, no "balance" calculations.
2. Confirm whether tenants see a count of any disputed deposit claims (recommended: yes, with a clear "Disputed" status pill).
3. Confirm the visual treatment of "rolling monthly" tenancy state.
4. Confirm whether the joint-tenant case shows the other tenant's name (recommended: yes, but only the name).
