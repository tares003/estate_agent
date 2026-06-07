# EPIC-AE — Platform marketing site (design)

**Dev brief:** [dev-briefs/v1/EPIC-AE-platform-marketing-site.md](../../dev-briefs/v1/EPIC-AE-platform-marketing-site.md).
**Pack:** Operator (always on for the platform operator; not tenant-facing).
**Status:** NOT_STARTED.

## Visual identity (distinct from tenant-facing product)

The platform marketing site **does not look like** a tenant's site. Where tenant sites are warm-editorial (property-photography-driven, brand-accent gold, photography-first), the platform marketing site is **operator-editorial** — bold, modern, software-product feel. It is intentionally not styled like an estate agency because it sells **to** estate agencies.

Specifically:
- Uses the platform operator's brand identity (likely a more saturated colour palette, geometric typography, product-screenshot-driven).
- Component primitives are still inherited from EPIC-L (Button, Card, Modal etc.) — token re-skinning lets the same primitives carry both identities.
- The marketing-site theme is a separate token preset, not a tenant theme override.

## Surfaces affected

- `/` (home — value proposition + social proof + CTAs).
- `/product` (product overview).
- `/features` (features by pack with anchor links).
- `/pricing` (pack catalogue + tier comparison + signup CTA).
- `/customers` (case studies + customer logos).
- `/customers/[slug]` (per-customer story).
- `/knowledge` (platform-operator blog / thought leadership).
- `/knowledge/[slug]` (article).
- `/about` (company story).
- `/contact` (general contact + demo request).
- `/trust` (security overview + compliance + sub-processors + status link).
- `/trust/sub-processors` (live sub-processor list).
- `/trust/security` (security overview).
- `/status` (status page — may iframe an external status-page product).
- `/roadmap` (public roadmap with Shipped / In progress / Planned / Backlog lanes).
- `/compare/[competitor]` (comparison vs Rex / Reapit / Alto / Jupix / etc.).
- `/legal/privacy`, `/legal/terms`, `/legal/cookies`, `/legal/dpa`.
- `/careers` (optional V1).

## Hero patterns

### Home page hero

- Bold headline communicating the product positioning in one sentence (e.g. "The modern platform for UK estate agencies — pay for what you actually use").
- Sub-headline expanding on the positioning.
- Two primary CTAs: "See pricing" (links to `/pricing`) and "Book a demo" (opens modal demo-request form).
- A confident product-screenshot hero with subtle elevation — shows the tenant admin in action.
- Customer logo strip below the hero.

### Pricing page

The most commercially critical surface. Layout:

- Header: short positioning line about the modular pricing model.
- Pack-toggle / tier-toggle: visitor picks "Show me Starter / Professional / Enterprise" to see the bundled packs at each tier.
- Pack catalogue grid: every pack as a card with name, one-line description, monthly price, "Included with [tier]" badge where applicable. Cards link to a deep dive of what the pack contains.
- Tier comparison table: Starter / Professional / Enterprise side-by-side with the pack-inclusion matrix from `PRODUCT.md` §5c and the metering quotas from §5e.
- Cumulative cost calculator: visitor selects a tier + adds optional packs and sees the projected monthly cost.
- Two CTAs: "Start with Starter" (deep links into signup with Starter pre-selected) and "Book a demo to discuss Enterprise" (opens modal demo form).

### Features by pack

- One section per pack with: pack name, headline, key features, representative screenshot, "Add to my signup" CTA that deep-links into signup with the pack pre-selected.

### Customer story

- Hero: customer logo + name + one-line summary of impact.
- Quote pull-out.
- Body: rich-text article describing the customer's journey.
- Sidebar: customer details (branches, vertical, packs in use), key metric callouts ("Cut response time by 60%").
- CTA at the bottom: "Read more customer stories" + "See pricing".

### Trust / security

- Three-pillar layout: Security / Compliance / Operations.
- Security: encryption at rest + in transit, 2FA, audit log, pen-test summary, vulnerability-disclosure policy.
- Compliance: GDPR, ICO registration, Property Ombudsman, Material Information, AML stance.
- Operations: status page link, uptime track record, incident-response SLA, backup posture.

### Sub-processor list

- Live table driven by the master sub-processor entity in the operator admin.
- Columns: sub-processor name, category, country, effective from, last reviewed.
- "Subscribe to change notifications" CTA — captures email, ties to the change-notification subscription per FR-AE-12.

### Roadmap

- Four lanes: Shipped / In progress / Planned / Backlog.
- Each card: feature or pack name, short description, estimated timeframe (e.g. "Q2 2026"), upvote affordance (per-feature visitor upvotes inform prioritisation).

### Comparison pages

- Header: "Estate Agency Platform vs [Competitor]".
- Capability comparison table: rows = capabilities, columns = the platform + the competitor + (optional) other competitors. Cells show ✓ / ✗ / partial.
- Legal disclosure footer: "Comparison data accurate as of [date]. Sourced from publicly available information. If you spot an inaccuracy, email us." — keeps the page legally clean.

## Component inventory

Mostly re-uses EPIC-L primitives. New additions:

`MarketingHero`, `PricingPackCatalogueGrid`, `PricingTierComparisonTable`, `CumulativeCostCalculator`, `FeaturePackSection`, `CustomerStoryHero`, `CustomerStoryArticle`, `TrustPillarSection`, `SubProcessorPublicList`, `RoadmapLaneBoard`, `ComparisonCapabilityTable`, `DemoRequestModal`. Built on EPIC-L primitives with operator-tier visual identity overrides.

## State variations

- **Pack catalogue with one or more packs in beta:** "Beta" badge on the pack tile with a tooltip "Early access — pricing may change".
- **No customer stories yet (early launch):** customer-story page shows "Coming soon — we're early. Want to be one of our first?" with a contact CTA.
- **Sub-processor change pending:** the public list shows a "Changes effective in 14 days" highlight on the affected row.
- **Status: incident in progress:** clear banner across every marketing-site screen linking to the incident on the status page.
- **Roadmap card upvote interaction:** instant visual confirmation that the upvote was registered.

## Accessibility specifics

- Cumulative cost calculator: live updates announced via `aria-live="polite"`.
- Comparison tables include header associations for screen readers.
- Status banner is `role="alert"` only on first appearance per session.
- Roadmap upvote uses real buttons; the count is exposed in the accessible name.

## Responsive (per RULE ZERO and `design-requirements.md` §0)

Every page rendered at every breakpoint (320, 640, 768, 1024, 1280, 1440, 2560 px). Specific responsive treatments:

- Tier comparison table on mobile: horizontal-scroll with sticky first column, OR pivot to a single-column-per-tier swipeable view (recommended).
- Pack catalogue grid: 3-up at `--breakpoint-xl`, 2-up at `--breakpoint-lg`, 1-up below.
- Cumulative cost calculator: input form above on mobile, side-by-side on desktop.
- Comparison capability table: same horizontal-scroll-with-sticky pattern as the pricing comparison.

## Motion

- Pack catalogue: gentle hover lift per `motion-spec.md` card rules.
- Tier toggle: cross-fade between tier states over `--motion-duration-base`.
- Cumulative cost: number cross-fades on change.
- Roadmap upvote: subtle scale-up on the count chip.
- Demo modal: standard modal animation per `motion-spec.md`.

## Token references

- Marketing-site theme token preset: re-skinned primitives using a more saturated brand palette (defined when the platform-operator brand identity is finalised).
- Pricing CTAs use the same primary-button treatment as the rest of the product so muscle memory carries across surfaces.

## Pack-state behaviour

Per `design-requirements.md` §2a — this surface is operator-owned and is **not pack-gated**; every prospect sees the full pack catalogue regardless of their (non-existent) tenant state. Pack-state appears here only as content (showing prospects what packs exist), never as gating.

## Open design questions

1. Confirm the platform operator's brand identity (logo, palette, typography) before sign-off.
2. Confirm whether the pricing calculator surfaces approximate annual cost or strict monthly cost only.
3. Confirm comparison-page editorial sign-off process (legal-required).
4. Confirm whether the status page is iframed from a specialist product or built in-house (recommended: integrate).
5. Confirm whether the careers page is in V1 (recommended: optional).
