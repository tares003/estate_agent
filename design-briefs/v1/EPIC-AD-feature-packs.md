# EPIC-AD — Feature packs and modular entitlement (design)

**Dev brief:** [dev-briefs/v1/EPIC-AD-feature-packs.md](../../dev-briefs/v1/EPIC-AD-feature-packs.md).
**Pack:** Core.
**Status:** NOT_STARTED.

## Surfaces affected

- **Tenant signup flow** — pack selection step.
- **Tenant admin → Plan & packs** — the self-serve pack management screen.
- **Tenant admin → Plan & packs → individual pack detail** — what the pack enables, current cost, current status.
- **Platform-operator admin → Tenant detail → Packs tab** — operator view of every tenant's pack state, including the support-mediated disable flow (EPIC-AB).
- **Tenant onboarding / welcome emails** — pack-aware ("Your Sales-plus pack is now live. Here's how to set up your first vendor portal user.").
- **Admin sidebar** — sections appear / disappear with pack state (lives in EPIC-H but the pack-aware logic is owned here).
- **Page-builder section catalogue** — section types appear / disappear with pack state.
- **Public site footer** — optional pack-aware footer link to a "Powered by" page on the platform's own marketing site.
- **Per-pack onboarding flows** — when a pack is newly enabled, the relevant admin section opens with a guided first-use experience.

## Tenant pack-management screen

This is the headline surface.

### Plan & packs landing

- Header: current plan tier (Starter / Professional / Enterprise) with month-to-date cost summary and next invoice date.
- Below: a grid of **pack tiles**.
- Each tile is a card showing:
  - Pack name.
  - One-line description.
  - "Included with your plan" / "Add-on" tag.
  - Current state (Active / Available / Trial).
  - For Active: monthly cost, "Manage" CTA.
  - For Available: monthly cost (and trial duration if applicable), "Enable" CTA.
  - For Trial: days remaining in trial, "Keep" / "Cancel before trial ends" CTAs.

### Pack enable modal

When the user clicks "Enable":

- Modal title: "Enable [Pack Name]".
- Pack details: full description, what surfaces become active, list of FRs in plain language.
- Pricing: monthly cost, when billing starts (now / after trial), prorated charge on the current invoice.
- Trial offer (if applicable): "Try free for 14 days. We'll remind you 3 days before the trial ends."
- Affirmation required: "I understand that enabling this pack will be billed from my next invoice" checkbox.
- Primary action: "Enable [Pack Name]".

### Pack management (post-enable)

- Detail page per active pack showing:
  - Status, enabled since, current trial state if applicable.
  - Configuration links (e.g. for `portal_syndication`: portal credentials, schedule).
  - Usage metrics for this pack.
  - **Cancel pack** link — opens a support ticket form (NOT a self-serve disable button per the commercial decision).
  - The support ticket form pre-fills: tenant, pack name, "Reason for cancellation" dropdown (Too expensive / Not using it / Bad fit / Other), optional comment. The form sets the tenant's request state to `pack_cancellation_requested` and notifies the platform-operator team.

## Tenant signup pack selection

Multi-step signup flow with a pack-selection step:

- After tier selection.
- Before payment details.
- Layout: tier-bundled packs shown as already-checked (read-only with "Included with your plan" tag); add-on packs shown as opt-in checkboxes with per-pack pricing displayed inline.
- "Skip — I'll set this up later" affordance — defaults to tier-bundled packs only.
- Summary panel on the right tallying the monthly cost as the user toggles add-ons.

## Pack onboarding flow

When a pack is newly enabled (whether from signup or post-launch):

- Toast confirmation: "Sales-plus pack is now active."
- The tenant admin sidebar adds the pack's section.
- The first time the user opens that section, a short guided tour overlay walks them through the key concepts (3-5 steps, dismissable, can be re-launched from the section's help menu).
- A welcome email per-pack delivered to the primary contact ("Your Sales-plus pack is live. Here's what to do first.").

## Empty / disabled section state

When a user lands on a pack-gated section without entitlement:

- The section shows a clearly-branded empty state: pack name, what it enables, marketing imagery, "Enable [pack] for £X/month" CTA.
- The CTA opens the pack enable modal directly.
- For an operator's tenant detail in platform admin: shows the pack as "Available — not yet enabled" with a "Enable on tenant's behalf" affordance.

## Operator-side pack management (in EPIC-AB)

The platform-operator admin gains a Packs tab per tenant:

- Table of every pack with current state per tenant.
- Bulk enable / bulk disable actions for support intervention.
- Pending cancellation tickets — listed with timestamp, reason, primary contact.
- Process-cancellation flow: review reason → confirm with tenant by email → execute disable → write audit-log entry.

## Component inventory

`PlanAndPacksLanding`, `PackTile`, `PackEnableModal`, `PackDetailPage`, `PackCancellationRequestForm`, `TenantSignupPackSelection`, `PackOnboardingTour`, `PackDisabledEmptyState`, `OperatorTenantPacksTab`, `OperatorPackCancellationQueue`. All built on EPIC-L primitives.

## State variations

- **All packs included with tier:** "You have every pack available. Manage individual packs below." (rare — only Enterprise).
- **Tenant on trial:** "Trial ends in 4 days" countdown banner with "Keep" / "Cancel" actions.
- **Pack newly enabled (within 24 hours):** "New" badge on the tile and on the sidebar entry.
- **Cancellation requested but not yet processed:** "Cancellation requested — our team will be in touch within 1 business day" notice on the pack detail.
- **Pack failed to enable (billing-provider error):** clear error state with retry CTA and a "Contact support" link.
- **Cross-pack dependency:** if a pack requires another pack to be enabled first (rare), show "Requires the X pack to be enabled" as the gating message.

## Accessibility specifics

- Pack tiles are real buttons / links with full keyboard reachability.
- The pack enable modal traps focus, Esc closes, the affirmation checkbox is properly labelled.
- Pack-state badges have `aria-label` describing state verbatim.
- Trial countdown is announced via `aria-live="polite"` only on day changes, not every second.

## Responsive

- Pack grid: 3 columns at `--breakpoint-xl`, 2 at `--breakpoint-lg`, 1 at `--breakpoint-md` and below.
- Pack tile content reorders so primary CTA is always above the fold on mobile.
- Signup pack-selection step uses a single-column stacked layout on mobile with the summary panel as a sticky bottom bar.
- Operator-side packs tab table converts to per-tenant cards below `--breakpoint-md`.

## Motion

- Enabling a pack: subtle success animation on the tile (border flash to `--colour-success`, ✓ icon appears) over `--motion-duration-base`. The sidebar entry slides in over `--motion-duration-base`.
- Cancellation request submitted: confirmation toast with `--motion-ease-emphasis`.
- Trial countdown banner: no motion.
- Pack onboarding tour: step transitions over `--motion-duration-base`; respect reduced-motion (steps appear instantly with no animation).

## Token references

- Pack-tile-active: `--colour-surface-base` with `--colour-success` accent border.
- Pack-tile-available: `--colour-surface-raised`.
- Pack-tile-trial: `--colour-brand-accent` border.
- Cancellation-pending banner: `--colour-warning` background.
- "Included with plan" tag: `--colour-info` background.

## Open design questions

1. Confirm the visual treatment of "Included with plan" vs "Add-on" packs — same tile style with different badge, or visually distinct grid sections.
2. Confirm whether trial end-date countdown is sticky (always visible) or only on the Plan & packs screen.
3. Confirm whether the per-pack onboarding tour is automatic on first open or requires user opt-in.
4. Confirm the operator-side bulk enable / disable affordance — checkbox per row vs select all (recommended: per row only, no bulk-affect-multiple-tenants action to reduce risk).
5. Confirm the visual treatment of a pack that depends on another pack (rare — currently no inter-pack dependencies; allow for future).
