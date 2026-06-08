# Master prompt log

Append-only progress + blocker log for the autonomous build. One block per phase, plus blocker entries as they arise.

---

## Phase B0 — Foundation bootstrap (scaffold)

Status: **in progress**
PR: _(branch `chore/phase-b-foundation`, not yet opened)_
Branch: `chore/phase-b-foundation`
Tests added: 0 (bootstrap is config/scaffold; TDD begins with `packages/config` guards and the foundation packages)
Coverage Δ: n/a

### STEP 0 — discovery (done, targeted)

Read for the foundation: `README.md`, `AGENTS.md`, `CLAUDE.md` §9, master spec §P / §S.13 / §S.13a, `dev-briefs/sprint-01/_cross-cutting.md` (DoD + 8 shared packages + §J migration scope + CI guards G1–G11), `_tdd-protocol.md` (RED/GREEN, 10 test layers, coverage gates), `dev-todo-sprint-01.md` (sprint scope), EPIC-P/EPIC-S briefs, EPIC-H SMTP additions (FR-H-10a / H.12a). Broad per-epic + canvas-screen discovery deferred to the phase that consumes each brief.

### STEP 1 — stack confirmation (done)

Stack confirmed by the user and recorded authoritatively in `AGENTS.md` §9 / `CLAUDE.md` §9:
- **Architecture:** two-stack — Django + Wagtail (content) + Next.js (app), JSON API between them, unified session-cookie auth.
- **DB / tenancy:** PostgreSQL 16 + PostGIS, **shared DB + Row-Level Security** (`SET LOCAL app.current_tenant_id`).
- **Hosting:** pure self-hosted on Hetzner (Docker + Coolify/Dokku).
- **Storage:** local filesystem behind `StorageBackend`. **CDN:** Cloudflare free tier. **Email:** per-tenant SMTP (basic + OAuth) / configurable operator SMTP. **SMS:** Twilio. **Maps:** per-tenant Google or Mapbox. **Anti-spam:** Turnstile. **Billing:** Stripe. **Analytics + error-monitoring:** deferred from V1 (structured logging only). **CI/CD:** GitHub Actions. **Secrets:** SOPS + age.

### B0 work completed this phase

- Created branch `chore/phase-b-foundation`.
- **Normalised the design canvas path** — flattened accidental `design/design/canvas/` → `design/canvas/` (91 files, `git mv`) to match every brief + the prompt's STEP 0f reference. Updated `.design-canvas-url`.
- **Repaired truncations** introduced during the stack write-up (see audit-report rows D-001, D-003).
- Root tooling: `.gitignore`, `.editorconfig`, `.nvmrc`, `.npmrc`, `package.json` (pnpm workspace), `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc.json`, `.prettierignore`.
- ADRs written (status **Proposed**): `0001-api-framework` (→ Django Ninja), `0002-smtp-credential-encryption` (→ first-party Fernet/MultiFernet), `0003-backup-target` (→ Hetzner Storage Box + restic, with geo-replica upgrade path).
- Workspace directory skeleton + per-package/service READMEs (see B0 continuation).

### Blockers / findings encountered

1. **AGENTS.md was truncated** mid-word at line 155 during the stack write-up — §9 incomplete. **Resolved:** reconstructed §9 by mirroring the complete `CLAUDE.md` §9 (tool-agnostic voice, RLS-correct). (audit-report D-001)
2. **CLAUDE.md internal contradiction** — per-surface table said EPIC-S = "Django-tenants (schema-per-tenant)" while every other section + the user's decision say shared-DB + RLS. **Resolved:** corrected to RLS in both files. (audit-report D-002)
3. **PRODUCT.md is truncated** at line 232 — the final sentence of §9a is cut off. PRODUCT.md is on the do-not-touch list (`AGENTS.md` §7), so this is **left for the owner to fix**. (audit-report D-003 — OPEN)
4. **Three open ADRs** (0001/0002/0003) recorded as Proposed; ADR-0001 must be ratified before Phase B2.

Token spend rough estimate: foundation discovery + stack repair + B0 bootstrap — moderate.

---

## Phase B0 — Config package + CI guards G1–G12 (2026-06-08, all-Next.js stack)

Status: **complete** (local; branch not yet pushed)
PR: _(branch `chore/phase-b0-config-guards`, not yet opened)_
Branch: `chore/phase-b0-config-guards`
Tests added: **67** (12 guard test files: 6 ESLint-RuleTester suites + 6 pure-function suites)
Coverage Δ: n/a (first test-bearing code; G2 coverage gate enforces on product-code PRs)

### Context

Session opened on the **all-Next.js + Payload CMS** stack (commit `e82f87e` pivoted away from the earlier two-stack Django+Wagtail design that the block above describes). Confirmed the stack is authoritatively recorded in `CLAUDE.md`/`AGENTS.md` §9.

### Decisions ratified by the platform owner (2026-06-08)

- **ADR-0001 → Accepted:** Server Actions only (no tRPC for V1).
- **ADR-0002 → Accepted:** Turborepo on pnpm.
- **ADR-0003 → stays Proposed:** backup target deferred to the launch-readiness checklist (not a foundation blocker).
- **Scope:** run autonomously through the Sprint-01 foundation, TDD, stopping only on a genuine blocker.

### Work completed

- Ratified ADR-0001/0002 in-file; added `turbo.json` task graph; wired `turbo` into root scripts + a `ci` script.
- **Fixed stale two-stack drift** left by the pivot: `package.json` description and `pnpm-workspace.yaml` comment now describe the single Next.js + Payload stack (no Django/uv side exists). (audit-report D-007)
- Built **`packages/config`**: tsconfig presets (library/react-library/next), ESLint flat configs (`eslint/base.js` + `eslint/react.js`), Vitest presets, the `@estate` ESLint plugin, and the twelve CI guards — each with a deliberate-violation fixture (fail-closed) + a clean fixture, TDD (RED committed before GREEN).
  - **ESLint rules:** G4 audit-log-coverage, G5 gdpr-consent, G6 naming, G7 design-token, G8 trust-marker, G12 pack-entitlement.
  - **Diff/report scripts:** G1 pr-has-tests, G2 coverage-threshold, G10 sub-processor-manifest, G11 responsive-coverage; runner `guards/run-all.ts`.
  - **Runtime-gate cores (unit-tested):** G3 performance-budget, G9 accessibility — their production-build / browser checks are wired as a CI job that activates when `apps/web` ships.
- `.github/workflows/ci.yml` (format · typecheck · lint+ESLint-guards · test+fail-closed-suites · diff-guards; runtime-gates job gated off until apps/web).
- `docs/sub-processors.json` (G10 manifest: Twilio/Stripe/Cloudflare) + `docs/ci-guards/g1..g12.md` explainers.
- Verification (all green): `format:check`, `turbo typecheck`, `turbo lint`, `turbo test` (67 tests), `run-all` guards; plus an adversarial real-`eslint` run confirming the six rules fire on a fixture and stay silent on a clean file.

### Methodology note

Used a read-only discovery workflow (9 agents) to extract the authoritative specs, then a parallel build workflow (11 agents) to implement guards G1–G5/G7–G12 in disjoint files following a hand-built, verified G6 reference pattern. Integration (plugin index, eslint/vitest configs, runner, CI, docs) and all final verification were done in the main loop. The G6 pattern + the toolchain were proven by hand first to de-risk the fan-out.

### Decisions / scope notes

- **G6 naming** automated set is scoped to unambiguous estate jargon (`lead(s)`, `inquiry/inquiries`, `renter(s)`, `realtor(s)`) to avoid false positives; ambiguous entity-name cases (`house`/`listing`) are enforced structurally via the canonical `@estate/types` `Property` type, not lint. (documented in `docs/ci-guards/g6-naming.md`)
- **Prettier format gate** scoped to code files; authored prose/spec/brief markdown is owned by product/design and excluded (consistent with the existing `.prettierignore` stance).
- **G3/G9** runtime checks are wired but inert until `apps/web` exists; their evaluation cores are unit-tested now.

### Blockers encountered

None. All gates green.

Token spend rough estimate: foundation discovery + B0 config/guards build (2 workflows, ~1.25M subagent tokens) — substantial.

### Next

B1 — `packages/tokens` (port `design/canvas/tokens.css`) → `packages/ui` primitives (EPIC-L) → `packages/types`/`validators` (§J) → `packages/entitlement` → `packages/db` (§J migrations + RLS) → shared helpers `audit()`/`notify()`/`recordConsent()` → `packages/auth` (Better Auth, EPIC-N).

---
