# EPIC-C — Public pages and sitemap

**Master spec reference:** Section C (C.1 through C.20).
**Pack:** Core (with new_homes, commercial, business_transfer, care_homes sections gated by their packs).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-C-public-pages-sitemap.md](../../design-briefs/v1/EPIC-C-public-pages-sitemap.md).
**Owns master-spec features:** B.1, B.2, B.3, B.4, B.14, B.30, B.31, B.32, B.36, B.37, B.38, B.39, B.40, B.41, B.42, B.43, B.44, B.45, B.46, B.47, B.48, B.50, B.51.

## Purpose

Implement the public-facing marketing surfaces: portal homepage, vertical landing pages, sellers / buyers / tenants / landlords / new homes / commercial / business transfer / care homes verticals, team page, locations, area guides, knowledge hub, contact, about, branches, legal pages.

## Functional requirements

- **FR-C-1.** A visitor shall be able to reach any vertical landing page in one click from the portal homepage.
- **FR-C-2.** Every vertical landing page shall render its sections in CMS-defined order without redeploy.
- **FR-C-3.** Every page shall expose a CMS-managed primary call to action.
- **FR-C-4.** The hero search bar on landing pages shall navigate the visitor to the unified `/properties` route with the appropriate `sale_type` and `listing_type` query parameters prefilled.
- **FR-C-5.** The portal homepage shall log a tile-click analytics event without performing any database write.
- **FR-C-6.** Every legal page (privacy, complaints, terms, cookies) shall be rendered as a CMS page using the same page-builder used for marketing pages.
- **FR-C-7.** The contact page shall route the contact form submission to the configured department inbox (sales, lettings, commercial, general).
- **FR-C-8.** The locations index shall list every published area guide.
- **FR-C-9.** Every area guide shall display the most recent N published properties whose `postcode_prefix` matches the guide's configured prefix list.
- **FR-C-10.** The knowledge-hub index shall paginate by the configured page size and shall expose a category filter.
- **FR-C-11.** Every public page shall emit its declared SEO metadata (see EPIC-O) on the rendered HTML.
- **FR-C-12.** The cookie banner shall present granular consent categories and shall gate the loading of non-essential scripts until consent is granted.
- **FR-C-13.** The platform shall serve `/sitemap.xml`, `/robots.txt`, `/feed.xml` per master spec Section C.20 and EPIC-O.

## User stories

- **As a** prospective buyer in Essex, **I want** to land on the portal and immediately see whether the agency handles sales, lettings, new homes or commercial properties **so that** I can find my relevant section in seconds.
- **As a** seller researching whether to instruct, **I want** to reach the seller landing page and see what marketing the agency does for me **so that** I can decide whether to request a valuation.
- **As an** existing tenant who lost the agency's contact card, **I want** to find the contact page with one click from any other public surface **so that** I can call them.
- **As a** content editor, **I want** to publish a new blog post and have it appear on the knowledge hub without involving engineering **so that** I can respond to market events.
- **As a** GDPR-conscious visitor, **I want** to reject non-essential cookies before any tracking script loads **so that** my visit is private.

## Acceptance criteria

- Every public route listed in master spec Section C resolves with a meaningful response.
- Direct URL with filter parameters reproduces the same view on every page that supports filters.
- The performance budget in `design-requirements.md` section 3 is met for every public route.
- Every form on every public page captures GDPR consent before allowing submission.
- The cookie banner enforces granular consent before any analytics or marketing script loads.
- The XML sitemap regenerates within 60 seconds of any publish or unpublish event.
- An accessibility audit of every public route returns zero AA violations.

## Test mapping

```
FR-C-1  → tests/e2e/portal-homepage.spec.* (asserts: every tile navigates to its vertical landing page)
FR-C-2  → tests/integration/page-builder.test.* (asserts: section ordering reflects CMS sort_order)
FR-C-3  → tests/integration/page-cta.test.* (asserts: every page exposes a primary CTA from the CMS)
FR-C-4  → tests/e2e/hero-search.spec.* (asserts: hero search redirects with correct query parameters)
FR-C-5  → tests/integration/portal-click-analytics.test.* (asserts: tile click writes analytics event, no DB write)
FR-C-6  → tests/component/legal-page-renderer.test.* (asserts: legal pages render via page-builder)
FR-C-7  → tests/integration/contact-form-routing.test.* (asserts: department routing follows configuration)
FR-C-8  → tests/integration/locations-index.test.* (asserts: only published guides appear)
FR-C-9  → tests/integration/area-guide-properties-feed.test.* (asserts: postcode prefix filter is honoured)
FR-C-10 → tests/integration/blog-index.test.* (asserts: pagination + category filter behave correctly)
FR-C-11 → tests/integration/seo-metadata-emission.test.* (asserts: declared SEO meta appears in rendered HTML)
FR-C-12 → tests/e2e/cookie-banner.spec.* (asserts: scripts blocked pre-consent, loaded post-consent)
FR-C-13 → tests/integration/system-routes.test.* (asserts: /sitemap.xml, /robots.txt, /feed.xml respond)
Visual  → tests/visual/portal-homepage.spec.*, tests/visual/vertical-landing-{sales,tenants,landlords,...}.spec.*
A11y    → tests/a11y/public-routes.spec.* (per every route)
Perf    → tests/performance/public-routes.spec.* (per `design-requirements.md` section 3)
```

## Dependencies

- EPIC-D (CMS page-builder) — required for every CMS-driven page.
- EPIC-F (property data) — required for property carousels on landing pages.
- EPIC-J (data requirements) — required for the pages, page_sections, area_guides entities.
- EPIC-L (frontend components) — required for hero, pillar, FAQ, testimonial sections.
- EPIC-M (design system) — required for tokens and component primitives.
- EPIC-N (security and GDPR) — required for cookie consent gating.
- EPIC-O (SEO) — required for metadata, structured data and sitemap emission.

## Open questions

1. Confirm whether a sixth portal tile is required (niche / luxury sub-brand). Master spec Section C.1 calls this "optional".
2. Confirm whether the careers page is internal (form + applications table) or external (link to a job board).
3. Confirm the locations URL convention (`/locations/[slug]` vs `/houses-for-sale-[slug]`).
4. Confirm whether print stylesheets are required for any public surface other than property detail.
