# EPIC-V — Outbound portal syndication

**Master spec reference:** Section Q.7 (Phase 7), Section B.54 (bulk import / feed support), Section P.2 (build-vs-buy).
**Pack:** `portal_syndication` (add-on).
**Status:** NOT_STARTED. **Phase: deferred to Phase 7 of the build roadmap.**
**Paired design brief:** [design-briefs/v1/EPIC-V-portal-syndication.md](../../design-briefs/v1/EPIC-V-portal-syndication.md).

## Purpose

Implement the outbound property syndication feed that publishes listings to the major UK property portals (Rightmove, Zoopla, OnTheMarket, and equivalents). This is a major buying criterion for real estate agencies — most agencies are contractually obligated to syndicate to at least Rightmove, and a platform that cannot syndicate is not a credible competitor.

This brief documents the requirements now, even though implementation work is deferred to Phase 7 per the master spec roadmap. PHASE A audit will mark this epic as DEFERRED.

## Supported portals (V1)

- **Rightmove** — BLM v3 outbound feed format.
- **Zoopla** — proprietary feed format.
- **OnTheMarket** — proprietary feed format.

Each portal has its own contract, feed location (FTP / SFTP / HTTPS endpoint), schedule, and validation rules. The platform must support all three and shall be extensible to additional portals (Boomin, Nestoria, regional portals) without re-architecture.

## Functional requirements

- **FR-V-1.** A platform administrator shall be able to configure outbound portal syndication per tenant, per portal, with credentials (FTP/SFTP/HTTPS), feed location, schedule, and a portal-specific branch identifier.
- **FR-V-2.** A tenant administrator shall be able to choose which of the tenant's published properties are eligible for syndication (default: every published property).
- **FR-V-3.** The platform shall generate a per-portal feed in the portal's required format on the configured cadence (default: every 30 minutes; portals may require more or less).
- **FR-V-4.** The feed shall include every eligible property's attributes mapped from the canonical property entity (master spec Section F) to the portal-specific schema.
- **FR-V-5.** The feed generation shall validate against the portal's schema before push. Validation failures are surfaced as alerts in the admin and the feed is not pushed until corrected.
- **FR-V-6.** A property whose `market_status` transitions to `sold`, `let`, `withdrawn` or whose `status` becomes `archived` shall be removed from the next feed push, with the appropriate "withdrawn" or "completed" record per portal spec.
- **FR-V-7.** Per-property syndication metadata shall be captured: per-portal `portal_listing_id` (assigned by the portal on successful publish), per-portal last-push timestamp, last-push outcome.
- **FR-V-8.** The platform shall surface per-portal sync history in the admin per property and per branch.
- **FR-V-9.** A failed push shall retry per the worker retry policy (EPIC-U). Persistent failure alerts the operations team and the tenant administrator.
- **FR-V-10.** A property's syndication eligibility shall be honoured at the tenant level (some tenants suspend syndication during contract disputes with a portal) and at the property level (some vendors specifically opt out).

## User stories

- As a branch manager, I want my newly-published property on Rightmove within 30 minutes so my vendor doesn't ask why.
- As a property manager, I want to suspend syndication of a sensitive listing (e.g. confidential business sale) without un-publishing it from my own site.
- As a platform administrator, I want to swap a tenant's Rightmove credentials without redeploying anything.
- As a tenant administrator caught in a dispute with one portal, I want to pause syndication to that portal while keeping the others active.

## Acceptance criteria

- A property published in the admin appears on each enabled portal within the next scheduled feed cycle plus the portal's own ingestion time.
- A property marked `sold` is removed from the next feed cycle to every enabled portal.
- A feed that fails validation does not push partial data — the entire cycle is held until corrected.
- Per-property sync metadata is queryable by property reference, branch, and portal.
- A persistent failure pages the operations team after the configured threshold of consecutive failures.

## Test mapping

```
FR-V-1  → tests/integration/portal-config-admin.test.*
FR-V-2  → tests/integration/property-syndication-eligibility.test.*
FR-V-3  → tests/integration/feed-generation-rightmove.test.*, tests/integration/feed-generation-zoopla.test.*, tests/integration/feed-generation-onthemarket.test.*
FR-V-4  → tests/integration/property-to-portal-mapping.test.* (per portal)
FR-V-5  → tests/integration/feed-validation.test.* (per portal schema)
FR-V-6  → tests/integration/feed-removal-on-sold.test.*
FR-V-7  → tests/integration/per-portal-sync-metadata.test.*
FR-V-8  → tests/integration/per-portal-sync-history.test.*
FR-V-9  → tests/integration/feed-push-retry.test.*
FR-V-10 → tests/integration/feed-eligibility-cascade.test.*
Regression → tests/regression/EPIC-V/EPIC-V-feed-removal-on-sold.regression.test.*
```

## Dependencies

- EPIC-F — property entity and its publish state.
- EPIC-J — `portal_syndications` table (new — to be added in Phase 7 migration).
- EPIC-U — the `portal_feed_push` worker.
- EPIC-H — the admin surfaces for portal configuration and per-property syndication status.
- Portal account / contract — each portal requires the tenant agency to have an active contract with the portal before syndication will be accepted.

## Open questions

1. Confirm the V1 portal list (recommended: Rightmove, Zoopla, OnTheMarket; consider Boomin and regional portals in Phase 8).
2. Confirm whether the platform offers a portal-credentials proxy (the tenant gives credentials to the platform) or a portal-credentials redirect (the tenant configures the portal to pull a feed from the platform). Recommended: support both per portal contract.
3. Confirm the policy on per-portal property metadata that has no canonical home in the property entity (e.g. portal-specific category codes) — store on `property_syndications.portal_metadata_json`.
4. Confirm the feed publish window and rate limits per portal contract.
5. Confirm whether portal lead-back (enquiries received via the portal) is in scope — recommended: yes, deferred to a follow-on brief.
