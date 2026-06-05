# EPIC-E — Static information areas

**Master spec reference:** Section E.
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-E-static-info.md](../../design-briefs/v1/EPIC-E-static-info.md).

## Purpose

Capture and surface the items that change rarely: company registration, ICO number, regulatory scheme memberships (Property Ombudsman, Propertymark, CMP), trading address, default currency / locale / time zone, default email sender. These appear in the public footer and on legal pages, and are referenced by the audit log and compliance markers.

## Functional requirements

- **FR-E-1.** A super-admin shall be able to edit static company information (legal trading name, company number, ICO number, regulatory scheme references, registered office address) through a dedicated settings screen.
- **FR-E-2.** Static information shall be exposed to every public page's footer renderer without requiring an additional fetch on every page load.
- **FR-E-3.** Regulatory certificate uploads (Property Ombudsman, ICO, Propertymark) shall be stored in the media library and linked from footer badges.
- **FR-E-4.** The platform shall ensure the privacy policy URL referenced from every form is current. A broken-link check shall run weekly.
- **FR-E-5.** Tenant-level overrides of static information shall be supported where the tenant's own legal entity differs from the platform operator's (sub-processor disclosure scenarios).

## User stories

- As a super-admin, I want to update the company registration line in one place and have it appear on every footer without code change.
- As a compliance officer, I want to re-upload the Property Ombudsman certificate annually so that the badge in the footer always links to the current document.

## Acceptance criteria

- Static information appears identically across every public page.
- The settings screen rejects an attempted save with an obviously invalid company number (e.g. wrong length).
- Tenant-level overrides take precedence over platform-level defaults where set.

## Test mapping

```
FR-E-1 → tests/integration/admin-static-info.test.*
FR-E-2 → tests/component/footer-renderer.test.*
FR-E-3 → tests/integration/certificate-upload.test.*
FR-E-4 → tests/integration/privacy-policy-link-check.test.*
FR-E-5 → tests/integration/tenant-static-override.test.*
```

## Dependencies

- EPIC-H (admin dashboard) — the settings screen.
- EPIC-J (data requirements) — the settings table.
- EPIC-N — only super-admins can edit static info.

## Open questions

1. Confirm whether static-information edits trigger an audit-log entry by default (recommended: yes).
2. Confirm whether certificate uploads need optical-character-recognition validation (probably not in V1).
