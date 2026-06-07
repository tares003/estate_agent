# EPIC-Y — Vendor (seller) portal (design)

**Dev brief:** [dev-briefs/v1/EPIC-Y-vendor-portal.md](../../dev-briefs/v1/EPIC-Y-vendor-portal.md).
**Status:** NOT_STARTED.

## Surfaces affected

- `/vendor/sign-in` (magic-link request page).
- `/vendor` (property list — if vendor has only one active property, redirect direct to it).
- `/vendor/properties/[id]` (per-property dashboard).
- `/vendor/properties/[id]/enquiries`, `/viewings`, `/offers`, `/marketing`, `/reports`.
- `/vendor/messages` (threaded with assigned agent).
- `/vendor/profile`.

## Layout patterns

### Sign-in

- Single input email field + "Email me a sign-in link" button.
- Plain language explanation: "We'll email you a sign-in link. No password needed."
- Status after submit: "Check your email. The link is valid for 30 minutes."

### Property dashboard (the headline screen)

- Hero strip: property title, address, status badge, list price, days on market, link to public listing.
- Four KPI tiles in a row: Total views (with sparkline), Enquiries, Viewings booked, Offers received. Each clickable, drills to its detail tab.
- "This week vs comparable" panel: bar showing the property's weekly enquiries and weekly viewings vs the median of the comparable set.
- Recent activity feed.
- "Message your agent" CTA.
- "Download monthly report" CTA.

### Per-tab detail views

- **Enquiries:** list with anonymised applicant (or name if agency policy allows), date, channel, status. Filterable.
- **Viewings:** chronological list with applicant, time, outcome, feedback (collapsible).
- **Offers:** card per offer with amount, position, agent recommendation, vendor action (Accept / Reject / Counter), audit history below.
- **Marketing:** thumbnails of every marketing asset (photos / floorplan / EPC / brochure / video / virtual tour) with download / view actions and last-updated timestamps. Portal syndication status row at the top.
- **Reports:** monthly report download list, plus a one-line summary of the latest report.

### Offer-response flow

- "Accept" opens a confirmation modal explaining what happens next (the agent will move to sale-agreed, no obligation until contracts).
- "Reject" requires a reason from a dropdown (Too low / Wrong position / Other) plus optional comment.
- "Counter" opens an inline form with a counter-offer amount and an optional message.

## Component inventory

`VendorSignInPage`, `VendorPropertyList`, `VendorPropertyDashboard`, `VendorKPITile`, `VendorComparablesPanel`, `VendorEnquiriesList`, `VendorViewingsList`, `VendorOfferCard`, `VendorOfferResponseModal`, `VendorMarketingAssets`, `VendorMessagesThread`, `VendorMonthlyReportDownload`, `VendorActivityFeed`. Built on the EPIC-L primitives.

## State variations

- **No active properties:** "You don't have any properties on the market with us right now" with a "Contact your agent" CTA.
- **Property just listed (< 7 days):** weekly comparison panel shows "Too early to compare" until 7 days have passed.
- **Sale agreed:** banner across the top of the property dashboard "Sale agreed at £X with [applicant position]". Offers tab becomes read-only.
- **Property completed / sold:** dashboard moves to a "Completed" archive showing final figures and a thank-you message.
- **No viewing feedback collected yet:** viewings list shows "No feedback yet" rather than an empty cell.

## Accessibility specifics

- KPI tiles have `aria-label` summarising the figure ("Total views: 423, up 12% this week").
- Comparable panel sparkline has a textual fallback summary.
- Offer-response modal traps focus, Esc closes, and the destructive "Reject" action requires explicit confirmation.

## Responsive

- KPI tiles stack 2x2 then 1-column on smaller viewports.
- Comparable panel becomes a vertical bar group on mobile.
- Marketing assets grid: 4 wide desktop, 2 mobile.

## Motion

- KPI value transitions cross-fade on update over `--motion-duration-base`.
- Sparkline draws in over `--motion-duration-slow` on initial load.
- Offer card slide-in when a new offer arrives in real time (gentle fade-in from below).

## Token references

- Status badges use property status tokens.
- KPI delta arrows use `--colour-success` for up, `--colour-danger` for down, `--colour-text-muted` for flat.
- Offer card border tint reflects offer state.

## Open design questions

1. Confirm whether the property dashboard shows comparison vs comparable properties (recommended: yes for established properties, deferred for new listings).
2. Confirm the visual treatment of the offer card when multiple offers compete (stacked vs side-by-side comparison view).
3. Confirm whether marketing assets are downloadable directly or only viewable inline.
4. Confirm whether the magic-link sign-in adds a "Remember this device" toggle (recommended: not in V1).
