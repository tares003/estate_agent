# EPIC-O — SEO

**Master spec reference:** Section O (O.1–O.9).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-O-seo.md](../../design-briefs/v1/EPIC-O-seo.md).

## Purpose

Implement the search-engine-optimisation surface: URL conventions, metadata, structured data, sitemap, robots.txt, performance, internal linking, local SEO, image alt-text discipline, and the redirect table.

## Functional requirements

- **FR-O-1.** Property URLs shall follow `/properties/{street-or-building}-{town}-{postcode-prefix}[-{disambig}]`.
- **FR-O-2.** URL casing shall be lowercase. Uppercase variants shall 301 to lowercase canonical.
- **FR-O-3.** Trailing slash convention shall be settled and enforced; the alternative shall 301 to the canonical.
- **FR-O-4.** Every page shall emit a meta title (≤60 chars), meta description (≤160 chars), canonical link, OG title / description / image / URL / type, and Twitter Card meta.
- **FR-O-5.** Every property page shall emit a valid `RealEstateListing` JSON-LD entry with name, description, URL, image, bedrooms, bathrooms, floor size, geo, address, offers.
- **FR-O-6.** Every page shall emit a `BreadcrumbList` JSON-LD entry.
- **FR-O-7.** Blog posts shall emit `Article` JSON-LD; area guides shall emit `Place` JSON-LD; team profiles shall emit `Person` JSON-LD; branch pages shall emit `RealEstateAgent` / `LocalBusiness` JSON-LD.
- **FR-O-8.** `/sitemap.xml` shall be a sitemap index pointing at child sitemaps (properties, pages, news, area guides, team).
- **FR-O-9.** `/robots.txt` shall disallow `/admin`, `/account`, `/api/*`, `/preview/*` and reference the sitemap.
- **FR-O-10.** Performance budgets in `design-requirements.md` section 3 shall be met for every public route.
- **FR-O-11.** A managed redirect rules table shall allow staff to add 301s for any URL change.
- **FR-O-12.** Slug changes on properties and area guides shall auto-create 301s from the prior slug.
- **FR-O-13.** Image alt text shall be mandatory on every property image; an auto-suggestion shall be provided but admins may override.

## Acceptance criteria

- A representative property page passes the Google Rich Results test.
- The sitemap index regenerates within 60 seconds of any publish.
- Robots.txt correctly disallows the protected paths.
- A URL casing variant correctly redirects to the canonical lowercase URL.
- Performance-budget CI gate passes for every public route.

## Test mapping

```
FR-O-1  → tests/unit/property-url-generator.test.*
FR-O-2  → tests/integration/url-casing-redirect.test.*
FR-O-3  → tests/integration/trailing-slash-redirect.test.*
FR-O-4  → tests/integration/seo-meta-emission.test.*
FR-O-5  → tests/integration/property-jsonld.test.* (validates against the schema)
FR-O-6  → tests/integration/breadcrumb-jsonld.test.*
FR-O-7  → tests/integration/per-entity-jsonld.test.*
FR-O-8  → tests/integration/sitemap-index.test.*, tests/integration/sitemap-children.test.*
FR-O-9  → tests/integration/robots-txt.test.*
FR-O-10 → tests/performance/public-routes.spec.*
FR-O-11 → tests/integration/redirect-rules.test.*
FR-O-12 → tests/integration/slug-change-301.test.*
FR-O-13 → tests/integration/property-image-alt-text.test.*
```

## Dependencies

- EPIC-C — every public page consumes the SEO infrastructure.
- EPIC-F — property URL generation and structured data.
- EPIC-J — the redirects table.

## Open questions

1. Confirm the policy on `noindex` for properties whose `market_status` is `sold` or `let` (recommended: keep indexed for SEO long-tail).
2. Confirm whether outbound portal feeds (Rightmove, Zoopla, OnTheMarket) are in V1 (recommended: deferred to Phase 7).
3. Confirm the OG image fallback strategy when a property has no main image.
