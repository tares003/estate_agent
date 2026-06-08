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

## Phase B1 — design tokens + foundation wave-1 (2026-06-08)

Status: **complete** (pushed to `main`)
Branches (fast-forwarded to main): `chore/phase-b1-tokens`, `chore/phase-b1-foundation-wave`
Main: `056ddbb` → `a7179bd` (tokens) → `387a95b` (wave-1)
Tests added: 3 (tokens drift) + 74 (validators) + 20 (entitlement) + 24 (ui Button) = **121**

### Shipped

- **`@estate/tokens` (EPIC-M):** ported `tokens.css` (140 tokens, verbatim) + a curated product `base.css` (reset/typography/focus/skip-link/container/reduced-motion/dark-seam — canvas chrome excluded) + a type-safe `var()` accessor for every token group. Drift test asserts the accessor ↔ css stay in exact sync. Pushed to main.
- **Parallel wave-1** (user chose "both tracks in parallel"; built via a 3-agent workflow, integrated + verified in the main loop):
  - **`@estate/validators`:** Zod schemas for buyer-enquiry / viewing / valuation / repair, each carrying `gdpr_consent` (G5-clean), canonical `enquiry` naming (G6); shared field helpers (email/ukPhone/ukPostcode); 100/100 coverage.
  - **`@estate/entitlement` (EPIC-AD):** `isPackEnabled` / `requirePack` / `<RequirePack>` + the 12-pack catalogue, with an injectable `PackSource` (Prisma-backed impl deferred to `@estate/db`). Makes **G12** enforce against a real helper. 100/100 coverage.
  - **`@estate/ui` (EPIC-L):** component-test infra (RTL + jsdom + axe) + the **Button** atom — variants/sizes/states, token-driven via `Button.css` (G7), `aria-busy` loading, 44px touch target. 90/80 coverage. The proven pattern for the remaining ~29 primitives.

### Verification (independent, not agent self-reports)

All green across 5 packages: `format:check`, `turbo typecheck`, `turbo lint` (incl. @estate guards), `turbo test` (121 tests), and `pnpm guards`. The diff-based guards now bite on real product code: **G2 evaluated 13 touched files against their coverage thresholds** (all pass), **G11 verified Button's test**, **G1** confirmed 16 impl files paired with tests. Adversarial: read `Button.css`/`Button.tsx` directly — confirmed token-driven and accessible.

### Findings

- **Design gap — no border-width token.** `Button.css` uses raw `1px`/`2px` hairline borders and a `0.5px` press nudge; this matches the design canvas itself (its `base.css` uses raw `1px`/`3px` for borders) — there is no `--border-width-*` token in DESIGN.md. G7 (ESLint) does not lint `.css` files, so it does not catch these. Recommend a DESIGN.md amendment to add border-width tokens (owner decision), or accept the hairline px as canvas-consistent. (audit-report D-008)
- **Spec divergence (validators).** Repair urgency 4th tier used `low` (per the build-wave spec) vs EPIC-G FR-G-5's `non-urgent`. Flag for reconciliation when EPIC-G is implemented.

### Blockers

None. Deferred (heavier infra, next waves): `packages/db` (Prisma + RLS — needs Postgres/Testcontainers), `audit()`/`notify()`/`recordConsent()` helpers, `packages/auth` (Better Auth), the remaining `@estate/ui` primitives + Playwright visual-regression at the 7 breakpoints (needs browsers/baselines).

Token spend rough estimate: tokens build + 2 parallel workflows + integration — substantial.

---

## Phase B2 — wave-2 both tracks (2026-06-08)

Status: **complete** (pushed to `main`; commits made directly on main per the "push to main" directive)
Main: `827a673` → `32c8a41`
Tests added: 14 (db) + 27+22+22+Badge+Spinner (ui atoms) ≈ **120**

### Infra probe (before building)

- **Docker daemon not running**, no local Postgres, `DATABASE_URL` unset → Testcontainers migration tests can't run in this dev env. Resolution: build the Prisma schema + raw SQL migrations (validate/generate need no live DB) and test RLS isolation with **pglite** (in-process Postgres, no Docker); Testcontainers + PostGIS-on-real-PG documented as the CI integration path.
- **Playwright browsers are cached** (chromium-1200 etc.) → visual-regression is feasible; deferred to responsive organisms (the wave-2 atoms are viewport-invariant → honest G11 opt-out, RTL + axe).

### Track A — `@estate/db` (EPIC-S / §J multi-tenancy spine)

- Prisma schema: `PlatformTenant` (with `enabled_packs` JSONB), `User`, and the cross-cutting tables `audit_logs` / `consent_logs` / `notification_logs` + enums. (Full §J per-entity catalogue is a dedicated follow-on.)
- Raw SQL migrations: `0001_postgis.sql` (PostGIS extension), `0002_rls_policies.sql` (RLS enable + tenant-isolation policies).
- `tenantGucStatement` (UUID-validated, injection-safe) + `withTenant` (transaction-scoped `SET LOCAL app.current_tenant_id`); `PrismaPackSource` implementing `@estate/entitlement`'s `PackSource` against `platform_tenants.enabled_packs`.
- `prisma validate` + `prisma generate` pass; **14 tests** incl. the pglite RLS isolation suite; 100% coverage on logic (client.ts excluded as DB-connection glue).
- **Bug found + fixed via the pglite test:** an unset custom GUC returns `''` (not NULL), so `''::uuid` *errored* instead of failing closed. Policy now uses `NULLIF(current_setting(...), '')::uuid` → unscoped access yields no rows gracefully. (audit-report D-009)

### Track B — `@estate/ui` atoms (EPIC-L, parallel workflow)

- TextField (+ EmailField/PhoneField/NumberField), Checkbox, Radio (+ RadioGroup), Badge, Spinner — token-driven CSS (G7), label association + aria wiring + 44px targets (G9), honest G11 opt-out for viewport-invariant atoms. Barrel updated to export all six atoms.

### Tooling

- `eslint/base.js`: the capability guards G4/G8/G12 are turned **off for test files** (tests legitimately reference pack slugs/prices/mutations as fixtures); G5/G6/G7 still apply. (Fixed a G12 false-positive on a db test fixture.)
- Root `package.json`: `pnpm.onlyBuiltDependencies` allows Prisma/esbuild/unrs-resolver install scripts (pnpm blocks them by default).
- `@estate/db` uses the `react-library` tsconfig preset so tsc can parse the JSX in entitlement's `<RequirePack>` pulled in via the `PackSource` type import.

### Verification

All 6 packages green: format · typecheck · lint · test · guards. The diff guards bite: G2 enforced coverage on touched files, G11 verified 5 atom tests, G1 paired 17 impl files with tests.

### Blockers / deferred

- Testcontainers Postgres integration (Docker unavailable in dev) — RLS proven via pglite; real-PG + PostGIS verification is the CI path.
- Next (wave-3): `audit()` / `notify()` / `recordConsent()` helpers (on the cross-cutting tables); `packages/auth` (Better Auth); full §J entity schema; UI molecules/organisms (PropertyCard, PackLockPill, UpsellEmptyState) + Playwright visual-regression at the 7 breakpoints for responsive surfaces.

Token spend rough estimate: infra probe + db build + parallel UI workflow + integration/fixes — substantial.

---
