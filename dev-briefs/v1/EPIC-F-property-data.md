# EPIC-F — Property listing data

**Master spec reference:** Section F (and per-vertical extensions F.1–F.6).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-F-property-data.md](../../design-briefs/v1/EPIC-F-property-data.md).

## Purpose

Implement the property entity with every attribute described in master spec Section F, the property image and document relations, the development entity for new homes, and the validation rules that govern property creation and editing.

## Functional requirements

- **FR-F-1.** A property record shall capture every attribute listed in master spec Section F (identification, lifecycle, pricing, specification, location, descriptions, media, agent assignment, SEO, audit metadata).
- **FR-F-2.** The property entity shall be discriminated by `listing_type` (residential, new home, commercial, business transfer, care home, land) — there shall not be a separate table per vertical.
- **FR-F-3.** Per-vertical extensions (F.1–F.6) shall be captured on the same entity, validated conditionally on `listing_type`.
- **FR-F-4.** The property URL slug shall be auto-generated from title, town and postcode prefix with a numeric disambiguation suffix on collision.
- **FR-F-5.** Slug changes shall auto-create a 301 redirect from the old slug to the new.
- **FR-F-6.** Property images shall be uploaded via pre-signed direct upload URLs. The application server shall never proxy media bytes.
- **FR-F-7.** Image manipulation (re-encoding to strip EXIF including location metadata, generating thumb and large variants) shall run as a background job after upload.
- **FR-F-8.** A property shall not be publishable unless the pre-flight checklist in master spec Section H.5 Tab 9 is satisfied or explicitly overridden with a typed reason recorded in the audit log.
- **FR-F-9.** The "Hide exact address" flag shall cause the public map marker to be offset by the configured radius and the public address to render with postcode prefix only.
- **FR-F-10.** Soft-deletion shall be supported. A soft-deleted property shall not appear in any public surface and shall not be enumerable from the public API.
- **FR-F-11.** Slug-collision detection shall be deterministic so that two simultaneous saves on the same street do not produce duplicate slugs.

## User stories

- As a sales agent, I want to create a new property with photos in under 5 minutes so that I can list quickly.
- As a property manager, I want to mark a vendor's address as private so that the public site shows only the street name and a fuzzy map marker.
- As a content editor, I want to re-upload a photo and have the new image automatically replace the old one in the gallery position.
- As a branch manager, I want to feature a property on the homepage so that we can showcase a flagship listing.

## Acceptance criteria

- A property can be created, populated and published from the admin end-to-end.
- Every per-vertical field is validated correctly (a residential listing does not require business turnover; a business-transfer listing does not require council tax band).
- Property URLs are stable: changing a property's title creates a 301 redirect rather than breaking the existing URL.
- Property images preserve their visual order across re-uploads and reorders.
- The "Hide exact address" toggle is honoured on every public surface that renders a location.
- The publish pre-flight checklist blocks publication when an override is not provided.

## Test mapping

```
FR-F-1  → tests/unit/property-schema.test.*
FR-F-2  → tests/integration/property-listing-type-discriminator.test.*
FR-F-3  → tests/integration/property-vertical-extensions.test.*
FR-F-4  → tests/unit/property-slug-generator.test.*
FR-F-5  → tests/integration/property-slug-redirect.test.*
FR-F-6  → tests/integration/property-image-presigned-upload.test.*
FR-F-7  → tests/integration/property-image-postprocess.test.*
FR-F-8  → tests/integration/property-publish-checklist.test.*
FR-F-9  → tests/component/property-map.test.*, tests/component/property-address.test.*
FR-F-10 → tests/integration/property-soft-delete.test.*
FR-F-11 → tests/integration/property-slug-collision.test.* (property-based)
Regression → tests/regression/EPIC-F/EPIC-F-publish-checklist.regression.test.*
```

## Dependencies

- EPIC-J (data requirements) — the properties, property_images, property_documents, developments tables.
- EPIC-K (interface capabilities) — the property capabilities (list, get, create, update, publish, etc).
- EPIC-L (frontend components) — PropertyCard, PropertyHero, PropertyFacts, PropertyGallery, PropertyMap.
- EPIC-N (security) — RBAC checks on every property mutation.
- EPIC-O (SEO) — JSON-LD emission on property detail pages.

## Open questions

1. Confirm the policy on a vendor changing the address after a property is under offer (slug change, audit-log entry, applicant notification?).
2. Confirm the default radius for the "Hide exact address" offset.
3. Confirm whether bulk import from existing CRM systems is in V1 scope (deferred to Phase 8 by default).
