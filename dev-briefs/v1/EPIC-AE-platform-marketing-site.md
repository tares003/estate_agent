# EPIC-AE — Platform marketing site

**Master spec reference:** N/A — this surface is outside the tenant-facing product but inside the platform-operator product responsibility. `PRODUCT.md` §5 carries the pack catalogue this brief surfaces commercially.
**Pack:** Operator (always on for the platform operator; not a tenant-side surface).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-AE-platform-marketing-site.md](../../design-briefs/v1/EPIC-AE-platform-marketing-site.md).

## Purpose

The **platform operator's own marketing site** — the surface that sells the SaaS to UK estate agencies. Distinct from any individual tenant's marketing site (which is the tenant-facing product, owned by EPIC-C and the rest). This surface lives at the platform's own canonical domain (e.g. `estateplatform.co.uk`) and is responsible for:

- Communicating what the platform does, who it's for, and the pricing model.
- Surfacing the pack catalogue with per-pack value propositions.
- Driving prospective agencies into signup or a demo conversation.
- Hosting the public-facing legal and regulatory documents that govern the SaaS (privacy policy, sub-processor list, status page, security overview).
- Providing a public roadmap and customer-story library.

This brief documents the surface. The implementation team builds it; the autonomous build agent works through it like any other surface, but recognises it has a different audience (prospects, not tenants).

## Functional requirements

- **FR-AE-1.** The platform marketing site shall be hosted at the platform's canonical domain and shall be the default landing for a visitor who hits the bare domain. Tenant-facing surfaces remain on `<tenant-slug>.<platform-domain>` and on tenants' custom domains.
- **FR-AE-2.** The platform marketing site shall expose, at minimum: home, product overview, features-by-pack, pricing, customer stories, knowledge / blog, about, contact, careers (optional), trust (security + compliance + sub-processors + status), legal pages.
- **FR-AE-3.** The pricing page shall render the pack catalogue from `PRODUCT.md` §5a authoritatively. Prices read from a configuration source (not hardcoded into the page) so that commercial changes don't require a redeploy.
- **FR-AE-4.** A pricing-page visitor shall be able to **start signup** with their selected tier and packs pre-filled, deep-linking into the tenant-provisioning flow (per EPIC-S).
- **FR-AE-5.** A prospect shall be able to **request a demo** through a form. Submissions create a platform-operator-side `enquiries` record with `lead_type=platform_prospect` (or similar — operator-side schema, not tenant-side).
- **FR-AE-6.** The site shall host the **sub-processor list** (per `PRODUCT.md` §6 compliance regime) and shall publish it automatically from the master sub-processor entity in the platform-operator admin (per EPIC-AB).
- **FR-AE-7.** The site shall host a **status page** reflecting current platform health, recent incidents and post-mortems. Status data is sourced from the operator system-health surface in EPIC-AB.
- **FR-AE-8.** The site shall host a **public roadmap** showing the next 1-2 quarters of planned pack additions and major feature releases, with explicit "Shipped / In progress / Planned / Backlog" lanes.
- **FR-AE-9.** The site shall be SEO-optimised for "estate agency software", "estate agency CRM UK", "property management SaaS UK" and the related long-tail terms.
- **FR-AE-10.** The site shall meet WCAG 2.2 AA, the performance budget in `design-requirements.md` §3, and the responsive mandate in `design-requirements.md` §0 (every breakpoint, no exceptions).
- **FR-AE-11.** The site's blog / knowledge content shall be CMS-managed using the same page-builder model as tenant CMS pages — the platform operator's editorial team uses the same authoring experience.
- **FR-AE-12.** The site shall expose a clearly-presented sub-processor change-notification subscription so existing tenant administrators receive proactive notice of upcoming sub-processor changes.
- **FR-AE-13.** The site shall offer a **comparison page** ("vs Rex", "vs Reapit", "vs Alto", "vs Jupix", etc.) covering the main UK estate-agency SaaS products, with factual, regularly-updated capability comparisons.

## User stories

- As a small-agency owner Googling "best estate agency website UK", I want to land on the platform's home page and understand within ten seconds whether this is for me.
- As a prospect comparing platforms, I want to see clear pack-by-pack pricing on one page so I can build a quote without contacting sales.
- As a tenant administrator wondering whether a new sub-processor change affects me, I want a public sub-processor list with effective dates.
- As a prospect evaluating reliability, I want to see the platform's status page and recent uptime before I sign a 12-month contract.
- As a platform operator's content editor, I want to publish a knowledge-hub article using the same page-builder I use for tenant CMS pages.

## Acceptance criteria

- A first-time visitor reaches the pricing page in ≤ 2 clicks from any landing route.
- The pricing page reflects the pack catalogue without code change when prices or tiers update.
- Signup from the pricing page lands the prospect in the tenant-provisioning flow with their selected tier + packs pre-filled.
- The demo-request form produces a platform-operator-side lead within 60 seconds.
- The sub-processor list shown publicly matches the master entity in the operator admin (verified by an automated daily check).
- The status page reflects current real-time platform health.
- The site meets the same accessibility, performance and responsive budgets the rest of the product meets.

## Test mapping

```
FR-AE-1  → tests/integration/platform-marketing-domain.test.*
FR-AE-2  → tests/e2e/platform-marketing-routes.spec.*
FR-AE-3  → tests/integration/pricing-page-from-config.test.*
FR-AE-4  → tests/e2e/pricing-to-signup-deep-link.spec.*
FR-AE-5  → tests/integration/demo-request-creates-lead.test.*
FR-AE-6  → tests/integration/sub-processor-list-public.test.*
FR-AE-7  → tests/integration/status-page.test.*
FR-AE-8  → tests/integration/public-roadmap.test.*
FR-AE-9  → tests/integration/marketing-site-seo.test.*
FR-AE-10 → tests/a11y/marketing-site.spec.*, tests/performance/marketing-site.spec.*
FR-AE-11 → tests/integration/marketing-site-cms.test.*
FR-AE-12 → tests/integration/sub-processor-change-subscription.test.*
FR-AE-13 → tests/integration/comparison-pages.test.*
```

## Dependencies

- EPIC-D — page-builder CMS (re-used for the marketing site's content management).
- EPIC-O — SEO infrastructure (re-used).
- EPIC-S — tenant-provisioning flow (deep-linked from pricing-page signup).
- EPIC-AB — operator admin (source of sub-processor list, status data, demo-request lead inbox).
- EPIC-AD — pack catalogue (the source of truth for pricing-page content).

## Open questions

1. Confirm whether the marketing site is in V1 scope or deferred — without it the platform launches headless and uses cold outreach for first customers (acceptable as a launch shortcut).
2. Confirm the comparison-page editorial responsibility (legal sign-off required because comparison pages name competitors).
3. Confirm whether customer logos and stories require explicit consent + opt-in per customer (recommended: yes, via a documented per-customer permission).
4. Confirm whether the status page is built first-party or integrates a specialist status-page product (recommended: integrate; this is not a differentiator).
5. Confirm whether the careers page is required at launch (recommended: optional V1).
