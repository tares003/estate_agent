# EPIC-Z — Landlord portal (design)

**Dev brief:** [dev-briefs/v1/EPIC-Z-landlord-portal.md](../../dev-briefs/v1/EPIC-Z-landlord-portal.md).
**Pack:** Core (Lettings is part of core per PRODUCT.md §5).
**Status:** NOT_STARTED.

## Surfaces affected

- `/landlord/sign-in` (magic-link).
- `/landlord` (portfolio dashboard).
- `/landlord/properties/[id]` (per-property dashboard).
- `/landlord/properties/[id]/tenancy`, `/rent`, `/repairs`, `/compliance`, `/statements`, `/renewal`, `/reletting`.
- `/landlord/messages`.
- `/landlord/profile`.

## Layout patterns

### Portfolio dashboard (landing)

- Header: number of managed properties, total monthly rent expected, total monthly rent received this month.
- Per-property compact card row: address, tenant first-name only, monthly rent, this-month payment status (paid / outstanding / late), compliance traffic-light (worst-of: gas / EICR / EPC / deposit), open repair count.
- Sort by: rent collection status (default), property address, alphabetical.

### Per-property dashboard

- Hero: address, current tenancy summary (tenant first-name + month-N of tenancy), monthly rent, rent collection sparkline (12 months).
- Compliance panel: gas / EICR / EPC / deposit-protection / Right-to-Rent each as a traffic-light tile with expiry date.
- Repairs panel: open tickets with status, last-update timestamp, "Approve" action where applicable.
- Renewal panel (shown only when tenancy is within 90 days of end): proposed renewal terms, action buttons.
- Re-letting panel (shown only when property is currently between tenancies): applicants in pipeline.

### Compliance dashboard

- Whole-portfolio view of every compliance item across every property, sorted by soonest expiry.
- Filter chips: All / Expiring (30 days) / Expired.
- "Schedule renewal" CTA per item (notifies the property manager).

### Rent dashboard

- Whole-portfolio rent timeline across last 12 months with per-month bars colour-coded paid / partial / outstanding.
- Click a bar to drill to the per-property collection records.

### Repair approval modal

- Repair details summary.
- Cost estimate or actual.
- Contractor name and trade.
- Photos (gallery).
- "Approve" CTA prominent. "Decline" requires reason from dropdown. "Request more info" sends a templated message to the property manager.

## Component inventory

`LandlordSignInPage`, `LandlordPortfolioDashboard`, `LandlordPropertyCard`, `LandlordPropertyDashboard`, `LandlordCompliancePanel`, `ComplianceTrafficLight`, `LandlordRentSparkline`, `LandlordRepairApprovalModal`, `LandlordRenewalPanel`, `LandlordReLettingPanel`, `LandlordStatementDownloadList`, `LandlordPortfolioRentTimeline`. Built on EPIC-L primitives.

## State variations

- **No managed properties:** "We don't manage any properties for you currently. Contact your property manager." with CTA.
- **All properties green compliance:** subtle green sash across the compliance panel ("All compliance items current").
- **Property between tenancies:** dashboard pivots from tenancy view to re-letting view.
- **Repair pending landlord approval > 48 hours:** amber highlight; persistent reminder in alerts panel.
- **Statement not yet generated for this month:** "Statement will be available on [day-of-month]" placeholder.

## Accessibility specifics

- Compliance traffic-lights have `aria-label` ("Gas safety: expires in 14 days") — colour is not the only signal.
- Rent timeline bars are keyboard-navigable; the focused bar announces its month and status.
- Repair approval modal `Approve` and `Decline` actions are clearly distinguished, with `Decline` always requiring confirmation.

## Responsive

- Portfolio dashboard property cards stack to 1-up on mobile.
- Compliance panel converts to a vertical traffic-light list on mobile.
- Per-property panels stack vertically on smaller viewports.

## Motion

- Compliance traffic-light pulses subtly when "amber" (within 30 days) — disabled under reduced motion.
- Rent sparkline draws over `--motion-duration-slow` on initial load.
- Repair approval action confirmation toast per standard rules.

## Token references

- Compliance traffic-light: `--colour-success` / `--colour-warning` / `--colour-danger`.
- Rent timeline bars: same trio.
- Statement download chips: `--colour-surface-raised`.

## Open design questions

1. Confirm whether the portfolio dashboard shows tenant names by default (recommended: first-name only).
2. Confirm whether the compliance panel includes the actual certificate as a downloadable link (recommended: yes).
3. Confirm the visual treatment of overdue repairs awaiting landlord approval (banner vs sash on the repair tile).
4. Confirm the rent timeline granularity (recommended: monthly).
