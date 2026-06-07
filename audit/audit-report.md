# Audit report — drift, findings & resolutions

Tracks discrepancies between the requirements foundation and reality, plus decisions taken during the build. Each row has a stable ID referenced by PR descriptions and the master-prompt-log.

Legend: **OPEN** (needs action) · **RESOLVED** · **PROPOSED** (recommendation pending ratification) · **ACCEPTED** · **DEFERRED**.

## Foundation findings (Phase B0)

| ID | Finding | Severity | Status | Resolution |
|---|---|---|---|---|
| D-001 | `AGENTS.md` truncated mid-word at line 155 during the stack write-up; §9 incomplete. | High | **RESOLVED** | §9 reconstructed by mirroring the complete `CLAUDE.md` §9 (tool-agnostic voice, RLS-correct). Now 316 lines, clean. |
| D-002 | `CLAUDE.md` §9 per-surface table contradicted itself: EPIC-S listed "Django-tenants (schema-per-tenant)" vs shared-DB + RLS everywhere else (and the user's explicit decision). | High | **RESOLVED** | Corrected the table cell to "Shared PostgreSQL + Row-Level Security" in both `CLAUDE.md` and `AGENTS.md`. |
| D-003 | `PRODUCT.md` truncated at line 232 — final sentence of §9a (responsive expectation) cut off. | Medium | **OPEN** | `PRODUCT.md` is on the do-not-touch list (`AGENTS.md` §7). **Owner action needed:** restore the final sentence of §9a. Substance is mirrored in `design-requirements.md` §2, so no build is blocked. |
| D-004 | Design canvas committed at doubled path `design/design/canvas/`; every brief + prompt reference `design/canvas/`. | Medium | **RESOLVED** | Flattened via `git mv` to `design/canvas/` (91 files). `.design-canvas-url` updated to `./design/canvas/`. |
| D-005 | `CLAUDE.md` §9 minor leftovers from earlier drafts: IaC line mentions "R2 buckets" (storage is local-fs); CI line mentions a Vercel deploy branch (hosting is committed self-hosted). | Low | **OPEN** | Cosmetic only. `AGENTS.md` mirror was written without these leftovers. Recommend the owner align `CLAUDE.md` (or accept minor drift). No build impact. |
| D-006 | Workspace package set is a **superset** of the §9 concrete layout: §9 lists `packages/{tokens,ui-components,validators,api-client}`; the foundation also requires `types`, `i18n`, `entitlement`, `config`, `helpers`, `email-templates` (per `_cross-cutting.md` §2 + the build prompt's STEP 2). | Info | **DOCUMENTED** | Extension documented in `docs/architecture/workspace-layout.md`. Consistent with §9's clause "if the stack mandates a different layout, document the deviation." |

## Open ADRs

| ID | Decision | Status | Gates |
|---|---|---|---|
| ADR-0001 | API framework → **Django Ninja** | **PROPOSED** | Phase B2 |
| ADR-0002 | SMTP credential encryption → **first-party Fernet/MultiFernet** | **PROPOSED** | EPIC-H §H.12 |
| ADR-0003 | Backup target → **Hetzner Storage Box + restic** (geo-replica upgrade path) | **PROPOSED** | First paying tenant |

## Deferred epics (not Sprint 01–04 scope)

| Epic | Pack | Deferred to |
|---|---|---|
| EPIC-V outbound portal syndication | `portal_syndication` | Master spec Phase 7 |
| EPIC-X bulk import | `bulk_import` | Master spec Phase 8 |
