# Dev todo — V1 epic index

This is the top-level inventory of every V1 dev brief. Each row links to its detailed brief under `dev-briefs/v1/`. The autonomous build prompt's STEP 0d discovery reads this file to build its mental inventory.

The status column reflects implementation state — initially every epic is NOT_STARTED because no code exists.

| Epic ID | Title | Brief | Status | Depends on | Notes |
|---|---|---|---|---|---|
| EPIC-A | Executive summary and architecture context | [dev-briefs/v1/EPIC-A-executive-summary.md](dev-briefs/v1/EPIC-A-executive-summary.md) | CONTEXT | — | No code; sets architectural direction for every other epic. |
| EPIC-B | Website feature audit (cross-reference) | [dev-briefs/v1/EPIC-B-feature-audit.md](dev-briefs/v1/EPIC-B-feature-audit.md) | CONTEXT | — | No code; lists every public-facing feature with priority. |
| EPIC-C | Public pages and sitemap | [dev-briefs/v1/EPIC-C-public-pages-sitemap.md](dev-briefs/v1/EPIC-C-public-pages-sitemap.md) | NOT_STARTED | EPIC-D, EPIC-F, EPIC-J, EPIC-L, EPIC-M | Public marketing surfaces. |
| EPIC-D | Backend configurable areas (CMS) | [dev-briefs/v1/EPIC-D-backend-configurable.md](dev-briefs/v1/EPIC-D-backend-configurable.md) | NOT_STARTED | EPIC-J | The page-builder and the editorial surface. |
| EPIC-E | Static information areas | [dev-briefs/v1/EPIC-E-static-info.md](dev-briefs/v1/EPIC-E-static-info.md) | NOT_STARTED | EPIC-J | Company registration, regulatory memberships. |
| EPIC-F | Property listing data requirements | [dev-briefs/v1/EPIC-F-property-data.md](dev-briefs/v1/EPIC-F-property-data.md) | NOT_STARTED | EPIC-J | The full property entity and its per-vertical extensions. |
| EPIC-G | Repair system | [dev-briefs/v1/EPIC-G-repair-system.md](dev-briefs/v1/EPIC-G-repair-system.md) | NOT_STARTED | EPIC-J, EPIC-K | Tenant repair form + admin workflow. |
| EPIC-H | Admin dashboard | [dev-briefs/v1/EPIC-H-admin-dashboard.md](dev-briefs/v1/EPIC-H-admin-dashboard.md) | NOT_STARTED | EPIC-J, EPIC-K, EPIC-L, EPIC-D | All 28 admin screens. |
| EPIC-I | CRM and lead workflow | [dev-briefs/v1/EPIC-I-crm-workflow.md](dev-briefs/v1/EPIC-I-crm-workflow.md) | NOT_STARTED | EPIC-H, EPIC-J | Unified lead queue, statuses, assignment, notifications. |
| EPIC-J | Data requirements (entities and attributes) | [dev-briefs/v1/EPIC-J-data-requirements.md](dev-briefs/v1/EPIC-J-data-requirements.md) | NOT_STARTED | — | Foundation entity model. Drives every other epic. |
| EPIC-K | Interface capabilities | [dev-briefs/v1/EPIC-K-interface-capabilities.md](dev-briefs/v1/EPIC-K-interface-capabilities.md) | NOT_STARTED | EPIC-J | The API capability set. |
| EPIC-L | Frontend components | [dev-briefs/v1/EPIC-L-frontend-components.md](dev-briefs/v1/EPIC-L-frontend-components.md) | NOT_STARTED | EPIC-M | Shared UI primitives and page-level organisms. |
| EPIC-M | UX and visual design system | [dev-briefs/v1/EPIC-M-design-system.md](dev-briefs/v1/EPIC-M-design-system.md) | NOT_STARTED | — | Tokens runtime, theme accessor, primitive components. |
| EPIC-N | Security and GDPR | [dev-briefs/v1/EPIC-N-security-gdpr.md](dev-briefs/v1/EPIC-N-security-gdpr.md) | NOT_STARTED | — | Authentication, authorisation, consent, audit log. |
| EPIC-O | SEO | [dev-briefs/v1/EPIC-O-seo.md](dev-briefs/v1/EPIC-O-seo.md) | NOT_STARTED | EPIC-C, EPIC-F | Metadata, structured data, sitemap, performance budget. |
| EPIC-P | Technology requirements (implementation-neutral) | [dev-briefs/v1/EPIC-P-technology-requirements.md](dev-briefs/v1/EPIC-P-technology-requirements.md) | CONTEXT | — | No code; sets capability requirements for stack choice. |
| EPIC-Q | Build roadmap (functional phases) | [dev-briefs/v1/EPIC-Q-build-roadmap.md](dev-briefs/v1/EPIC-Q-build-roadmap.md) | CONTEXT | — | No code; sequences the build phases. |
| EPIC-R | Cross-cutting (definition of done, glossary, open questions) | [dev-briefs/v1/EPIC-R-cross-cutting.md](dev-briefs/v1/EPIC-R-cross-cutting.md) | CONTEXT | — | No code; defers to `_cross-cutting.md` and `_tdd-protocol.md`. |
| EPIC-S | Hosting and multi-tenancy NFRs | [dev-briefs/v1/EPIC-S-hosting-multi-tenancy.md](dev-briefs/v1/EPIC-S-hosting-multi-tenancy.md) | NOT_STARTED | — | Non-functional. Tested by hosting choice + integration tests. |

## Status legend

- **CONTEXT** — informational, not a unit of implementation work; the brief sets direction.
- **NOT_STARTED** — implementation work exists but has not been picked up.
- **PARTIAL** — some implementation in place, some FRs unmet.
- **STUB** — placeholder file exists, no real implementation.
- **COMPLETE_BUT_DRIFTED** — implementation exists but contradicts the current brief.
- **COMPLETE_AND_CORRECT** — implementation matches the brief.

## Sprint scope

For the current sprint's scope, see [dev-todo-sprint-01.md](dev-todo-sprint-01.md).

## Designer-side mirror

The matching designer index is at [designer-todo.md](designer-todo.md). Every dev brief has a paired design brief; the agent should consult both when implementing visual work.
