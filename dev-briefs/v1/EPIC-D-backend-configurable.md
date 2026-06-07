# EPIC-D — Backend configurable areas (CMS)

**Master spec reference:** Section D.
**Pack:** Core (with pack-dependent section types gated).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-D-backend-configurable.md](../../design-briefs/v1/EPIC-D-backend-configurable.md).

## Purpose

Implement the page-builder content management system that drives every editorial surface (portal homepage, vertical landing pages, area guides, blog, legal pages, footer, menus, settings).

## Functional requirements

- **FR-D-1.** A managed page shall consist of an ordered list of typed sections. Each section's content shall validate against the schema declared for its type.
- **FR-D-2.** Section types in V1 shall include: hero, hero_video, two_column, three_pillar, four_pillar, stats_row, testimonials, faq, property_carousel, property_grid, video, cta_strip, contact_info, gallery, rich_text, form_embed, pricing_tiers, team_grid, developments_grid, partner_logos, accordion.
- **FR-D-3.** A content editor shall be able to add, remove and reorder sections without engineering involvement.
- **FR-D-4.** A page shall support draft, preview and publish states. A draft shall be viewable at a tokenised preview URL without affecting the live page.
- **FR-D-5.** Publishing a page shall create a versioned snapshot. Restoring a prior version shall be one click and shall create a new version (no destructive overwrite).
- **FR-D-6.** A section shall support time-limited visibility (visible-from / visible-until dates).
- **FR-D-7.** Navigation menus (header, footer, mobile) shall be CMS-managed with reorderable items, optional icons, target windows and role gates.
- **FR-D-8.** Email templates shall be CMS-managed with subject, preheader, structured body, declared variables and send-test capability.

## User stories

- As a content editor, I want to drag-and-drop sections on a landing page and preview the result so that I can iterate on the page without engineering help.
- As a marketing manager, I want to schedule a landing page change to publish at a specific date and time so that I can land a campaign without staying up at midnight.
- As a content editor, I want to restore yesterday's version of a page so that I can recover from a mistake.
- As an editorial reviewer, I want to see a tokenised preview link for a draft page so that I can review without exposing the change publicly.

## Acceptance criteria

- Every page-builder section type has a typed schema and validates inputs on save.
- A non-developer can create a new page, populate it with five sections and publish it in under 5 minutes.
- Restoring a prior page version produces an exact replica of the prior state.
- Draft pages are not discoverable from the public site and do not appear in the sitemap until published.
- Menus rendered on the public site reflect CMS state within 60 seconds of save.

## Test mapping

```
FR-D-1 → tests/integration/page-builder-validation.test.*
FR-D-2 → tests/unit/section-type-registry.test.*
FR-D-3 → tests/e2e/admin-page-builder.spec.*
FR-D-4 → tests/integration/page-preview-token.test.*
FR-D-5 → tests/integration/page-versioning.test.*
FR-D-6 → tests/integration/section-visibility-window.test.*
FR-D-7 → tests/e2e/admin-menus.spec.*
FR-D-8 → tests/e2e/admin-email-templates.spec.*
```

## Dependencies

- EPIC-J (data requirements) — pages, page_sections, menus, menu_items, email_templates entities.
- EPIC-H (admin dashboard) — the page-builder UI lives inside the admin shell.
- EPIC-L (frontend components) — every section type renders via a shared component.

## Open questions

1. Confirm whether A/B testing of sections is in V1 scope or deferred to Phase 8.
2. Confirm the maximum number of sections per page (cap at 30? higher?).
3. Confirm whether per-tenant section-type extensions are needed in V1 (custom section types).
