# EPIC-S — Hosting and multi-tenancy (design)

**Dev brief:** [dev-briefs/v1/EPIC-S-hosting-multi-tenancy.md](../../dev-briefs/v1/EPIC-S-hosting-multi-tenancy.md).
**Master spec reference:** Section S.
**Pack:** Core.
**Status:** NOT_STARTED.

## Surfaces affected

- Tenant signup flow (platform-owned, not per-tenant).
- Custom-domain configuration wizard (in tenant admin).
- Tenant lifecycle status indicators (provisioning, active, suspended, deprovisioning, failed).
- Billing and usage view (in tenant admin).
- Suspended-tenant public holding page.
- Platform-operator admin (separate from tenant admin) for tenant operations.

## Custom-domain wizard

Multi-step wizard. The step layout is important because steps 3 and 4 contain a human-in-the-loop wait at the client's DNS registrar.

- **Step 1 — Enter domain.** Single input. Validate domain format. Reject domains that are already attached to another tenant.
- **Step 2 — Verify ownership.** Show the CNAME record(s) the user must add at their registrar to prove control. Provide copy-to-clipboard buttons.
- **Step 3 — Wait for certificate.** Show a polling status with "We're waiting for your DNS records to propagate. This usually takes 5-30 minutes." Refresh button.
- **Step 4 — Add traffic CNAME.** Show the final CNAME the user must add to route traffic to the platform. Copy-to-clipboard.
- **Step 5 — Done.** Confirm both records are detected and the certificate is issued. Show the live URL.
- **Failure path:** if any step fails (cert validation, DNS resolution), show a clear retry path and a "Contact support" CTA.

## Billing and usage view

- Per-period usage summary: active listings, media storage, bandwidth egress, outbound email.
- Visual bar per metric showing usage vs included quota.
- Projected overage based on current-period trajectory.
- Plan summary and "Change plan" CTA.
- Invoice history table.
- Payment-method management.

## Suspended-tenant holding page

- A CMS-managed page (so each tenant's holding message can be personalised).
- Default copy: "This site is temporarily unavailable. Please contact [agency name] directly on [phone]." No platform branding.
- The platform-operator administrator manages the global default; per-tenant overrides allowed.

## Lifecycle status indicators

In the platform-operator admin, every tenant has a state pill:

- **Provisioning:** amber pill, animated dot.
- **Active:** green pill, solid dot.
- **Suspended:** grey pill, paused-icon.
- **Deprovisioning:** amber pill, animated countdown.
- **Deleted:** none — tenant moves to an archive view.
- **Provisioning failed:** red pill, alert icon, "Investigate" link.

## Component inventory

`CustomDomainWizard`, `BillingUsageView`, `UsageBar`, `SuspendedHoldingPage`, `TenantLifecycleStatusPill`, `TenantOperationsTable` (platform admin).

## State variations

- **Custom-domain wizard at each step:** loading, success, error, retry.
- **Billing usage at each metric:** under quota, approaching quota (≥ 80%), over quota.
- **Suspended holding page:** placeholder customisation preview in the admin.

## Accessibility specifics

- Wizard step indicator announces "Step X of 5" via `aria-current`.
- Copy-to-clipboard buttons announce "Copied" via `aria-live="polite"`.
- Usage bars include numeric label adjacent to the bar; the bar itself is decorative.
- Status pills include `aria-label` describing the state.

## Responsive

- Wizard is mobile-first; the DNS-record display becomes a stacked card with horizontal scroll for the long record values.
- Billing view stacks the metrics vertically below `--breakpoint-md`.

## Motion

- Status pill animation respects `prefers-reduced-motion` — animated dot becomes a solid dot when reduced motion is requested.
- Wizard step transitions: `--motion-duration-base`.

## Token references

- Provisioning amber: `--colour-warning`.
- Active green: `--colour-success`.
- Suspended grey: `--colour-text-muted`.
- Failed red: `--colour-danger`.

## Open design questions

1. Confirm the suspended-tenant holding-page default copy.
2. Confirm whether the custom-domain wizard supports `www` and apex variants in a single flow (recommended: yes).
3. Confirm the visual treatment of the platform-operator admin (separate visual identity from tenant admin? same shell?).
4. Confirm the billing view's payment-method UX (rely on the chosen payment provider's hosted UI vs custom UI).
