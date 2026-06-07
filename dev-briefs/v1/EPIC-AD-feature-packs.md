# EPIC-AD — Feature packs and modular entitlement

**Master spec reference:** Section H.24 (feature flags), Section S.13 (hosting options), Section P.2 (build-vs-buy), `PRODUCT.md` §5 (tier model).
**Pack:** Core (the entitlement system itself is core platform infrastructure).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-AD-feature-packs.md](../../design-briefs/v1/EPIC-AD-feature-packs.md).

## Purpose

The platform is sold as a **modular product**. Every tenant agency gets a core set of capabilities (sales + lettings) and chooses which optional **feature packs** they want. A tenant's enabled packs determine which screens, capabilities, workers, public surfaces and admin sections are active for them.

This epic owns:
- The pack catalogue and pack-membership rules.
- The entitlement model (which packs a tenant has, which tier they're on).
- The per-pack feature-flag evaluation logic at every code branch that depends on pack state.
- The tenant-operator pack-management surface (self-serve enable; support-mediated disable).
- The billing integration that fires when a pack is enabled.
- The public-site visibility logic (a vertical landing page disappears if its pack is off).
- The migration path from "monolithic single-tier platform" to "modular platform" without disruption.

## The pack catalogue

The authoritative catalogue lives in `PRODUCT.md` §5. Summary below for reference; the spec there is the source of truth.

| Pack slug | Description | Always on? | Owning briefs |
|---|---|---|---|
| `core` | Public marketing site, property catalogue, property detail, contact form, viewing requests, basic CRM, basic admin, customer accounts, SEO, security/compliance/audit, **plus the full Lettings experience** (repair flow, tenant portal, landlord portal, deposit-protection display, gas safety / EICR / EPC compliance tracking) | Yes | EPIC-A through EPIC-AC except the ones below |
| `sales_plus` | Vendor portal, comparables panel, offers entity, monthly vendor reports, vendor-side viewing feedback display | No | EPIC-Y |
| `new_homes` | Developments entity, "From price" qualifier, "new homes only" filter, off-plan flag, new-homes vertical landing | No | New-homes parts of EPIC-C and EPIC-F |
| `commercial` | Commercial-specific property attributes (use class, business rates, VAT, sqft critical), commercial enquiry form, commercial vertical landing | No | Commercial parts of EPIC-C and EPIC-F |
| `business_transfer` | Business-transfer attributes (turnover, P&L, confidentiality), business enquiry, business-transfer vertical landing | No | Business-transfer parts of EPIC-C and EPIC-F |
| `care_homes` | CQC rating, bed count, services offered, care-home vertical | No | Care-home parts of EPIC-C and EPIC-F |
| `portal_syndication` | Outbound Rightmove / Zoopla / OnTheMarket feeds | No | EPIC-V |
| `calculators` | Stamp Duty + Mortgage calculators (embeddable + standalone) | No | EPIC-W |
| `bulk_import` | CSV / XML import + scheduled feed from existing CRMs | No (often a one-off) | EPIC-X |
| `feedback_reviews` | Cross-journey feedback collection, moderation queue, data-driven reviews badge, agent league table | No | EPIC-AC |
| `live_chat` | Embedded chat product integration | No | Integration in EPIC-H §H.16 |
| `ai_assistant` | AI rewrite of descriptions, AI alt-text suggestion, AI meta-title generation | No | Scattered across EPIC-D, EPIC-F, EPIC-H |

## Functional requirements

- **FR-AD-1.** Every tenant shall have a stored entitlement list — `platform.tenants.enabled_packs` — containing zero or more optional-pack slugs from the catalogue. The core pack is implicit and not stored.
- **FR-AD-2.** A pack toggle shall be a single config change; no code change is required to enable or disable a pack for a tenant.
- **FR-AD-3.** Every code branch that depends on pack state shall consult the entitlement helper (`isPackEnabled(tenant, pack_slug)`), never read the entitlement field directly. Bypassing the helper fails CI guard G12 (see below).
- **FR-AD-4.** A tenant operator with the `pack.manage` permission shall be able to **enable** a pack from the admin self-serve, taking effect within 60 seconds. Enabling fires the billing event for the next invoice.
- **FR-AD-5.** Disabling a pack shall not be self-serve. A tenant operator requesting disablement opens a support ticket (via the platform-operator admin); the platform operator processes it with a documented downgrade procedure. Self-serve disable is intentionally disallowed per the commercial decision (live-enable, support-disable model).
- **FR-AD-6.** Enabling a pack shall not break any existing tenant data — even if a tenant disables and later re-enables, data persists.
- **FR-AD-7.** Disabling a pack shall hide its surfaces from public and admin, **but shall not delete** the underlying data. Disable preserves; deprovision deletes.
- **FR-AD-8.** Every public surface that depends on a pack (e.g. the new-homes vertical landing page) shall return a 404 to public traffic when the pack is off. The route shall not be enumerable from the sitemap or robots.
- **FR-AD-9.** Every admin section that depends on a pack (e.g. the Vendor portal admin) shall be hidden from the sidebar navigation when the pack is off. Direct URL access shall redirect to `/admin` with a clear "This section requires the X pack" message.
- **FR-AD-10.** Every worker that depends on a pack (e.g. `portal_feed_push` requires `portal_syndication`) shall short-circuit when the pack is off for that tenant. Workers running per-tenant-fan-out filter the tenant list by entitlement before dispatching.
- **FR-AD-11.** Every API capability defined in EPIC-K shall declare its pack dependency (default: `core`); the capability handler shall return 404 or 403 for tenants whose pack is off.
- **FR-AD-12.** Plan tier (Starter / Professional / Enterprise) shall define a **default bundle** of packs. Subscribing to a tier auto-enables the bundled packs. Adding a pack outside the bundle is the add-on flow.
- **FR-AD-13.** The page-builder shall hide pack-dependent section types from the catalogue picker when the pack is off (e.g. the "developments grid" section type only appears when `new_homes` is enabled).
- **FR-AD-14.** Every billing-relevant event (pack enabled, pack disabled, tier change) shall be captured in `platform.tenant_events` and synchronised to the billing provider within 5 minutes.
- **FR-AD-15.** A new tenant signup shall include a pack-selection step where the tenant picks the optional packs they want on day one. Defaults are pre-selected per the chosen tier.

## New CI guard

### G12 — Pack-entitlement guard

Statically analyses every handler, every worker, every page route, every admin sidebar entry, and every page-builder section type in the diff. Fails if the artefact's owning pack (per the brief's `Pack:` header) is not consulted via the entitlement helper before the artefact does pack-dependent work. Acceptable patterns: an explicit `requirePack('sales_plus')` decorator, an `isPackEnabled` check, or an explicit comment `// pack: core` confirming the artefact runs always.

## User stories

- As a sales-only agency, I want to sign up without paying for vendor-portal or AI features I don't need.
- As an agency growing into vendor self-service, I want to enable the Sales-plus pack from my admin and have it work immediately.
- As a tenant operator who turned on the AI assistant pack and then realised it's not for us, I want a clear support route to turn it off (not a self-serve button — we deliberately don't make downgrading frictionless).
- As a platform operator, I want one place where I can see every tenant's pack state and per-pack revenue.
- As a sales engineer demonstrating the platform, I want to flip packs on and off to show prospects what each pack enables, in a sandbox tenant.

## Acceptance criteria

- A new sales-only tenant signing up gets a working public site, property catalogue, property detail, lead capture, basic admin and customer accounts — and nothing else — using only the core pack.
- Enabling the Vendor portal pack on a tenant takes effect within 60 seconds — the `/vendor/sign-in` route returns 200, the admin sidebar adds the Vendor-management entry, the vendor portal becomes reachable.
- Disabling the same pack via support: vendor routes return 404, vendor data is preserved, audit-log entry records the action.
- A direct hit on `/admin/feedback` for a tenant without the `feedback_reviews` pack redirects to `/admin` with the documented message.
- The new-homes vertical landing page does not appear in the public sitemap for a tenant whose `new_homes` pack is off.
- The portal-syndication worker skips tenants without the `portal_syndication` pack.
- A page-builder editor for a tenant without the `new_homes` pack does not offer the "developments grid" section type.
- A tenant who enabled and then disabled a pack three months later, then re-enables it, finds their previous configuration and data intact.
- The G12 CI guard rejects a deliberate-violation fixture where a handler does pack-dependent work without an entitlement check.

## Test mapping

```
FR-AD-1  → tests/integration/tenant-entitlement-storage.test.*
FR-AD-2  → tests/integration/pack-toggle-no-code-change.test.*
FR-AD-3  → tests/integration/entitlement-helper-coverage.test.* (the G12 positive test)
FR-AD-4  → tests/e2e/self-serve-pack-enable.spec.*, tests/integration/pack-enable-billing.test.*
FR-AD-5  → tests/integration/pack-disable-requires-support.test.*
FR-AD-6  → tests/integration/pack-data-persistence.test.*
FR-AD-7  → tests/integration/pack-disable-hides-not-deletes.test.*
FR-AD-8  → tests/integration/public-route-404-on-pack-off.test.* (per pack-gated route)
FR-AD-9  → tests/integration/admin-section-visibility.test.* (per pack-gated section)
FR-AD-10 → tests/integration/worker-pack-scoping.test.* (per pack-gated worker)
FR-AD-11 → tests/integration/capability-pack-gating.test.* (per pack-gated capability)
FR-AD-12 → tests/integration/tier-pack-bundle.test.*
FR-AD-13 → tests/integration/page-builder-section-type-visibility.test.*
FR-AD-14 → tests/integration/pack-billing-event-sync.test.*
FR-AD-15 → tests/e2e/tenant-signup-pack-selection.spec.*
Security → tests/security/cross-pack-access.test.* (a tenant cannot reach a pack's data without entitlement)
Regression → tests/regression/EPIC-AD/EPIC-AD-pack-disable-preserves-data.regression.test.*
```

## Dependencies

- EPIC-J — `platform.tenants` gains `enabled_packs` (jsonb / text[]); `platform.tenant_events` captures pack-state transitions.
- EPIC-N — `pack.manage` permission added to the role catalogue.
- EPIC-S — pack state is part of every tenant's lifecycle; per-tenant authorisation now factors pack entitlement at the data layer.
- EPIC-K — every capability declares a pack dependency in its handler metadata.
- EPIC-U — workers check pack entitlement before per-tenant fan-out.
- EPIC-AB — operator admin gains the pack-management surface and the support-disable workflow.

## Open questions

1. Confirm whether the **billing model** integrates with a single billing provider (e.g. Stripe Subscriptions with metered usage) or fans out to multiple providers per region. (Recommended: single provider in V1.)
2. Confirm whether a **trial period** is offered per pack (e.g. "30 days free, then £X/mo") or only at tenant level. (Recommended: per-pack 14-day trial, configurable per pack.)
3. Confirm the **bundle defaults per tier** — Starter / Professional / Enterprise — in `PRODUCT.md` §5.
4. Confirm whether the **AI assistant pack** should be one pack or split (one for content, one for triage, one for analytics).
5. Confirm whether **operator-tier impersonation** (EPIC-AB) can override pack state for support purposes. (Recommended: yes, with audit log and time-limited.)
6. Confirm the **public marketing site** for the platform itself surfaces the pack catalogue with pricing — or only the tier model with packs as upsells.
