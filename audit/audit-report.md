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
| D-011 | **WebAuthn/passkey not in better-auth core.** `@estate/auth` wires staff 2FA via the in-core `twoFactor` (TOTP) plugin; hardware-key/passkey (FR-N WebAuthn) lives in a separate `@better-auth/passkey` package that is not installed. | Medium | **OPEN** | Owner decision: add `@better-auth/passkey` (an amendment / new sub-processor-free dep) to enable passkey 2FA. TOTP 2FA satisfies the 2FA requirement in the interim. |
| D-010 | **Status-badge colour-contrast fails WCAG AA.** PropertyCard status badges use white text on the saturated `--colour-status-*` fills (e.g. white on the available green ≈ 2:1); surfaced by the real-browser Playwright+axe spec. The canvas itself specifies white-on-status badges. | Medium | **OPEN** | DESIGN.md tokens are do-not-touch. Owner decision: darken the status fills, switch badge text to a dark token on light fills, or enlarge/embolden badge text to qualify as large text. Status is still conveyed by text + aria-label (G9 holds); the gap is badge-text legibility for low-vision users. The CT spec excludes `.badge` from contrast pending this. |
| D-009 | **RLS policy errored on unset tenant context.** A Postgres custom GUC defaults to `''` (not NULL) when unset, so `current_setting('app.current_tenant_id', true)::uuid` raised `invalid input syntax for type uuid: ""` on an unscoped query instead of failing closed. Surfaced by the pglite RLS test. | High | **RESOLVED** | Policy + migration now use `NULLIF(current_setting(...), '')::uuid` → unset context yields NULL → no rows (graceful fail-closed). |
| D-008 | **No border-width token** in DESIGN.md. `packages/ui` `Button.css` uses raw `1px`/`2px` hairline borders + a `0.5px` press nudge — matching the design canvas's own `base.css` (raw `1px`/`3px` borders). G7 (ESLint) does not lint `.css`, so it does not flag these. | Low | **OPEN** | Owner decision: add `--border-width-*` token(s) via a DESIGN.md amendment, or accept hairline px as canvas-consistent. No build impact; recorded for design-system completeness. |
| D-007 | Stale **two-stack** references survived the all-Next.js pivot (`e82f87e`): `package.json` description and `pnpm-workspace.yaml` comment named a Django+Wagtail / uv side that no longer exists; the prior `master-prompt-log` B0 block and this report's Open-ADRs table referenced the superseded ADR set (Django Ninja / SMTP-Fernet). | Medium | **RESOLVED** | Rewrote `package.json` description + `pnpm-workspace.yaml` comment for the single Next.js + Payload stack; refreshed the Open-ADRs table below to the current ADR set; appended a new dated B0 block to the log. |
| D-012 | **Cross-tenant FK reference on a user-supplied id** (surfaced in Phase B10). The buyer-enquiry form submits `propertyId` as a hidden field; `submitEnquiry` writes it to `Enquiry.propertyId` (a nullable FK to `Property.id`). RLS scopes the INSERT to the current tenant, but Postgres FK validation runs with RLS bypassed, so a crafted POST could link an enquiry (correctly in tenant A) to **another tenant's** property id. Low blast-radius (the enquiry itself is tenant-correct), but it is a tenant-isolation seam. | Medium | **OPEN** | Platform-wide pattern (every user-supplied tenant-scoped FK). Recommended fix at the data layer: **composite FKs `(tenant_id, id)`** referencing `Property(tenant_id, id)` so same-tenant references are enforced in the schema for all such relations — not a per-action patch. Tracked as a background task. |
| D-013 | **Anti-spam (Cloudflare Turnstile) not yet wired on the public enquiry form** (Phase B10). CLAUDE.md §9 names Turnstile as the challenge-response layer "verified server-side on every form submission", and `@estate/ui` ships `AntiSpamChallenge`, but the EPIC-F enquiry form does not yet capture/verify a Turnstile token. No CI guard enforces Turnstile presence (G5 = consent, G8 = trust-marker), so this is a requirement gap, not a lint failure. | Medium | **OPEN** | Cross-cutting across all public forms (enquiry, viewing, valuation, repair). Recommended: a shared `<TurnstileField>` + a server-side `verifyTurnstile()` helper applied once to every public Server Action. Tracked as a background task. |
| D-014 | **No multiline Textarea atom in `@estate/ui`** (Phase B10). The enquiry "Message" field uses the single-line `TextField` because the EPIC-L component set has no Textarea primitive. Functional and accessible, but a long message is cramped. | Low | **OPEN** | Add a `Textarea` atom to `packages/ui` (token-driven, label/hint/error wired like `TextField`) and switch the message field to it. No build impact. |

## Open ADRs

The ADR files on disk after the all-Next.js pivot are `docs/adr/0001-data-fetching.md`, `0002-monorepo-tool.md`, `0003-backup-target.md` (the earlier Django-Ninja / SMTP-encryption ADRs no longer exist — see D-007).

| ID | Decision | Status | Gates |
|---|---|---|---|
| ADR-0001 | Client data fetching → **Server Actions only** (no tRPC for V1) | **ACCEPTED** (ratified 2026-06-08) | EPIC-K / Phase B2 |
| ADR-0002 | Monorepo orchestrator → **Turborepo on pnpm** | **ACCEPTED** (ratified 2026-06-08) | Phase B0 scaffold |
| ADR-0003 | Backup target → **Hetzner Storage Box + restic** (geo-replica upgrade path) | **PROPOSED** (deferred to launch-readiness checklist) | First paying tenant |

## Deferred epics (not Sprint 01–04 scope)

| Epic | Pack | Deferred to |
|---|---|---|
| EPIC-V outbound portal syndication | `portal_syndication` | Master spec Phase 7 |
| EPIC-X bulk import | `bulk_import` | Master spec Phase 8 |
