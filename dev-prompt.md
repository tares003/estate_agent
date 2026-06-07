# Dev Claude — autonomous build prompt

Paste this into a fresh Claude Code (or Cursor / Codex / equivalent) session that has read/write access to this repo (the **Estate Agent** working folder). It is the build-side counterpart to `design-prompt.md`; their outputs feed each other. **Run `design-prompt.md` first** — this prompt expects the design canvas at `design/canvas/index.html` to exist. If it doesn't, stop and run the design prompt before continuing.

═══════════════════════════════════════════════════════════════
RULE ZERO — DISCIPLINE IS NOT OPTIONAL
═══════════════════════════════════════════════════════════════

Before anything else, internalise the five non-negotiables enforced by CI:

1. **TDD.** Every behaviour is written test-first. The RED commit (failing test) is separate from the GREEN commit (implementation). The `PR-has-tests` guard (G1) rejects any implementation diff with no test diff. Read `dev-briefs/sprint-01/_tdd-protocol.md` before writing a line of code.

2. **Token-literal UI.** No raw hex, no raw px, no raw ms in any component. Every visual value references a token from the design system (mirrors `design/canvas/tokens.css`, sourced from `DESIGN.md` and `motion-spec.md`). The `design-token` guard (G7) fails on raw values. New tokens require a documented `DESIGN.md` amendment.

3. **Audit-log every state-changing action.** The `audit-log-coverage` guard (G4) rejects any create / update / delete capability that doesn't emit an `audit_logs` row via the shared `audit()` helper.

4. **GDPR consent on every personal-data form.** The compliance lint (G5) rejects any form schema that captures personal data without a consent affirmation.

5. **Pack-aware code.** The platform is a **modular product** — every code path that depends on which feature packs a tenant has enabled (per `PRODUCT.md` §5a) must consult the entitlement helper (`isPackEnabled(tenant, pack_slug)`). The `pack-entitlement` guard (G12) rejects handlers, workers, routes, sidebar entries and page-builder section types that do pack-dependent work without an explicit `requirePack()` or `isPackEnabled()` check.

Plus the universal mandates:

- **Responsive at all seven breakpoints** (320 · 640 · 768 · 1024 · 1280 · 1440 · 2560). The `responsive-coverage` guard (G11) rejects component or page tests missing a viewport assertion per breakpoint.
- **WCAG 2.2 AA at every breakpoint.** Touch targets ≥ 44 px, focus rings, label association, no hover-only interactions. The `a11y` guard (G9) enforces.
- **Performance budgets** per `design-requirements.md` §3 — the `performance-budget` guard (G3) enforces.
- **Canonical naming** per `PRODUCT.md` §2 — the `naming` guard (G6) enforces.

═══════════════════════════════════════════════════════════════
STEP 0 — DISCOVERY (read-only, one-time)
═══════════════════════════════════════════════════════════════

Read, in order, and build a mental model **before** touching code:

  0a. **Requirements foundation:**
      - `README.md` — repo overview and folder map.
      - `PRODUCT.md` — canonical naming (§2 + §3 forbidden alternatives), UI vocabulary (§4), tier model and pack catalogue (§5a–§5e), compliance regime (§6), brand voice (§7), universal trust markers (§8), responsive expectation (§9a).
      - `Property-Agency-Website-Implementation-Spec.md` — the master spec, sections A through S.
      - `DESIGN.md` — design tokens (the authoritative token set).
      - `motion-spec.md` — duration, easing, per-component motion rules, reduced-motion behaviour.
      - `design-requirements.md` — accessibility, **§0 universal mandates**, **§2 responsive**, **§2a modular pack-state patterns**, §3 performance budgets, §7 four-state requirements.

  0b. **Conventions:**
      - `AGENTS.md` — the binding rules-of-engagement for AI agents working on this repo: do not invent a stack, do not invent product behaviour, follow naming and tokens literally, TDD, audit-log, GDPR, performance budgets, the files you must not touch, the standing question to confirm before code begins.

  0c. **Discipline docs:**
      - `dev-briefs/sprint-01/_tdd-protocol.md` — RED/GREEN/REFACTOR discipline, ten test layers, per-ticket test mapping, coverage gates, regression harness, fixtures, mocking policy, spike escape hatch.
      - `dev-briefs/sprint-01/_cross-cutting.md` — universal DoD (responsive verified at every breakpoint is item 4), foundation shared packages, foundation migrations, **all twelve CI guards G1–G12**, PR sequencing, telemetry baseline, failure-mode handling, sprint-01 out-of-scope.

  0d. **Sprint backlog:**
      - `dev-todo.md` — top-level index of every epic (A through AE) with status, dependencies, pack ownership and notes.
      - `dev-todo-sprint-01.md` — Sprint 01 scope is **foundation only** (entities, shared packages, CI guards, theme runtime, auth foundations). Subsequent sprints add the feature epics.
      - `designer-todo.md` and `designer-todo-sprint-01.md` for awareness of what design has shipped.

  0e. **Per-epic dev briefs** at `dev-briefs/v1/EPIC-*.md`. There are 31 (A through AE). Each carries:
      - A `**Pack:**` header naming the owning feature pack (`core`, `sales_plus`, `new_homes`, etc., or `Operator`).
      - Numbered FR statements.
      - User stories.
      - Acceptance criteria.
      - Test mapping (specific test files + assertion names per FR).
      - Dependencies.
      - Open questions.

      The matching `design-briefs/v1/EPIC-*.md` carries the visual / interaction spec for the same scope, including the per-epic **Pack-state behaviour** section documenting how that surface adapts when its pack is on vs off.

      Seven epics are **CONTEXT-only** (read, don't implement code from): A executive summary, B feature audit, J data-requirements-overview, K interface-capabilities-overview, P technology-requirements, Q build-roadmap, R cross-cutting. The data model in J and the capabilities in K are *implemented* — but the briefs themselves are descriptions, not units of work.

      Two epics are **DEFERRED** with a status note in their brief: V outbound portal syndication (Phase 7), X bulk import (Phase 8). Don't implement them in Sprint 01 or 02.

  0f. **The design canvas** at `design/canvas/` is the visual source of truth your component tests assert against. For every component or screen you build, open its canvas artefact:
      - `design/canvas/tokens.css` → port to the chosen styling system verbatim (token names and values).
      - `design/canvas/base.css` → reset, typography, focus default, reduced-motion seam.
      - `design/canvas/components/atoms/` and `components/molecules/` → the EPIC-L primitives.
      - `design/canvas/components/organisms/` → the universal **PropertyCard** in all nine `market_status` variants, **PackLockPill**, **UpsellEmptyState**, **TrialCountdownPill**, **PackEnableModal**, and the other organisms referenced by feature briefs.
      - `design/canvas/screens/` → every public, admin, customer-account, portal, marketing and email surface with their interactive behaviours prototyped.
      - `design/canvas/states/` → the four state patterns (empty / loading / error / success) that every data-fetching surface inherits.
      - `design/canvas/responsive/` → the breakpoint-demo files showing every artefact at all seven viewports.
      - `design/canvas/responsive-coverage.json` → the per-artefact breakpoint contract your visual-regression suite mirrors.
      - `audit/design-discovery-gaps.md` → any gaps the design Claude logged (token / spec questions awaiting a `DESIGN.md` owner decision). **Resolve these with the design owner before depending on the affected tokens.**

  0g. **Tenant-side admin and operator-side admin are distinct.** Read `dev-briefs/v1/EPIC-H-admin-dashboard.md` (tenant admin) and `dev-briefs/v1/EPIC-AB-platform-operator-admin.md` (operator admin) carefully — they live on different routes, have different visual identities, and have different RBAC scopes. Don't conflate them.

═══════════════════════════════════════════════════════════════
STEP 1 — CONFIRM THE STACK (blocking — do not skip)
═══════════════════════════════════════════════════════════════

`AGENTS.md` §1 and §9 are explicit: **the stack is not chosen and you must not invent it.** Section P of the master spec lists the *capabilities* the stack must provide. Before writing application code, confirm and record in `AGENTS.md` §1 (or in a new top-level `STACK.md` referenced from `AGENTS.md`):

- Web framework, language, runtime.
- Database product + hosting; ORM / query layer.
- Object storage, CDN, email provider, SMS provider, mapping provider, analytics provider, error-monitoring product, structured-logging product.
- Anti-spam / challenge-response provider.
- Billing provider (Stripe-equivalent — required because the modular product needs subscription + per-pack billing).
- Hosting model (master spec §S.13: pure hyperscaler, hybrid, or pure self-hosted).
- CI/CD product, deployment pipeline.

Until these are recorded, **do not commit application code.** If the user has not chosen, ASK once — presenting the capability requirements from §P and §S.13 as the decision frame. Recommend defensible defaults but do not assume.

═══════════════════════════════════════════════════════════════
STEP 2 — SCAFFOLD (Phase B0)
═══════════════════════════════════════════════════════════════

Once the stack is recorded, scaffold the workspace per `AGENTS.md` §4:

```
apps/
  web/                    ← public marketing site + customer accounts
  admin/                  ← tenant admin (may be a route within web/ or a separate app)
  operator/               ← platform-operator admin (always separate domain per EPIC-AB)
  marketing/              ← platform operator's own marketing site per EPIC-AE
services/
  api/                    ← primary platform API
  workers/                ← background jobs per EPIC-U
packages/
  types/                  ← shared type definitions per master spec §J entities
  validators/             ← shared input validation schemas per EPIC-K capabilities
  ui/                     ← shared component library — ports the design canvas
  config/                 ← shared lint, format and CI rules (including custom guards G1–G12)
  email-templates/        ← shared transactional email source
  tokens/                 ← runtime accessor for design tokens
  entitlement/            ← per-tenant pack entitlement helper per EPIC-AD (isPackEnabled, requirePack)
infrastructure/           ← IaC, deployment, per master spec §S non-functional requirements
docs/
  runbooks/               ← provisioning, restore, suspend, rotate-secrets, incident response
  adr/                    ← architectural decision records
```

Then, in this order (each as its own PR with TDD discipline):

1. **`packages/config`** — lint, format, type-check, all twelve custom guards G1–G12 wired into CI and **failing-closed** on a deliberate-violation fixture.
2. **`packages/tokens` + `packages/ui`** — port `design/canvas/tokens.css` + `design/canvas/base.css`; build every EPIC-L atom and molecule **test-first** against its canvas artefact. This is the dependency every feature epic sits on (EPIC-L → EPIC-M → everything).
3. **`packages/types` + `packages/validators`** — shared entities (canonical names from `PRODUCT.md` §2; covers every entity in master spec §J) and input schemas (consent-required on personal-data forms per G5).
4. **`packages/entitlement`** — the per-tenant pack-entitlement helper per EPIC-AD (`isPackEnabled`, `requirePack` decorator / middleware). Wired into G12.
5. **Foundation migrations** — every entity in master spec §J (and the `platform.tenants.enabled_packs` field per EPIC-AD §J.1 amendment). Each migration ships with an up + down + test per `_tdd-protocol.md`.
6. **Shared helpers** — `audit()`, `notify()`, `recordConsent()` from `_cross-cutting.md` §2.

Commit conventions per `AGENTS.md` §5: Conventional Commits; one PR per phase; each phase ≥ 3 commits (`test()` RED, `feat()` GREEN, `refactor()` clean-up — omit if no refactor was needed); `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

═══════════════════════════════════════════════════════════════
PHASE ORDER — BUILD BY EPIC IN DEPENDENCY ORDER
═══════════════════════════════════════════════════════════════

Mirror the design canvas's build order — the patterns are already proven there. Every phase is one PR. **Every screen is built to match its canvas artefact at all seven breakpoints**, with G11 verification per the responsive-coverage contract.

- **B1 · EPIC-L + EPIC-M + EPIC-AD foundation** — component library + theme runtime + pack-entitlement helper. Includes `PackLockPill`, `UpsellEmptyState`, `TrialCountdownPill`, `PackEnableModal` in the shared library so every later phase can consume them.

- **B2 · EPIC-J + EPIC-K + EPIC-N foundation** — entity migrations, capability scaffolds, auth foundations (sign-in / sign-out / password reset / email verify / 2FA enrolment), RBAC enforcement at the data layer, audit / notify / consent helpers.

- **B3 · EPIC-C public marketing surfaces** — portal homepage, vertical landings (Sales / Tenants / Landlords / Sellers — pack-gated for New Homes / Commercial / Business Transfer / Care Homes per `design-requirements.md` §2a), area guides, knowledge hub, contact, branches, legal pages. Include the **calculators** (EPIC-W) on the relevant landing pages — they're pack-gated by the `calculators` pack.

- **B4 · EPIC-F public property surfaces + EPIC-O SEO** — property catalogue, property detail, search filters, map view, the universal PropertyCard, JSON-LD emission, sitemap, robots.txt, redirect rules. Per-vertical attributes (Commercial / Business Transfer / Care Home) follow the pack-gated attribute-group pattern.

- **B5 · EPIC-D CMS page builder** — page editor, section catalogue (with pack-gated section types marked `PackLockPill`), preview, versioning, scheduled publish, menus, footer, email-template editor.

- **B6 · EPIC-H tenant admin** — admin shell, dashboard overview, property editor, calendar, contacts, settings hierarchy (including theme editor, integrations, branches, **Plan & packs** screen per EPIC-AD), users and roles, audit log viewer, reports, scheduled-tasks console, search admin, command palette. Every pack-gated admin section uses the locked-section `UpsellEmptyState` pattern when its pack is off.

- **B7 · EPIC-I CRM + EPIC-T customer accounts** — unified lead queue, lead detail, assignment-rules editor, SLA configuration; customer register / sign-in / saved properties / saved searches / viewings / profile / settings / account deletion.

- **B8 · EPIC-G repair system** — tenant 6-step repair form, file uploads via pre-signed URLs, admin repair inbox, contractor magic-link portal, threaded messaging, SLA badge logic, recurring maintenance generator.

- **B9 · EPIC-Z + EPIC-AA portals** — landlord portal (always-on per core pack), tenant portal (always-on per core pack). Both inherit the EPIC-L primitives and the same magic-link auth pattern.

- **B10 · EPIC-Y vendor portal** — `sales_plus` pack-gated; engagement metrics, viewings, offers, marketing assets, monthly reports. Routes return 404 when the pack is off (no admin breach surface).

- **B11 · EPIC-AC feedback and reviews** — `feedback_reviews` pack-gated feedback form, moderation queue, data-driven public reviews badge, agent league table.

- **B12 · EPIC-U background workers** — every worker in the catalogue (`saved_search_alerts_*`, `sitemap_regenerate`, `expired_property_archive`, `compliance_alert_scan`, `recurring_maintenance_generator`, `retention_purge`, `notification_log_purge`, `audit_log_cold_storage`, `daily_usage_rollup`, `weekly_digest_email`, etc.). Per-tenant fan-out filtered by pack entitlement.

- **B13 · EPIC-S multi-tenancy** — tenant registry, provisioning workflow per master spec §S.5 (10-minute target), per-tenant authorisation at the data layer, custom-domain wizard (day-one buying criterion per §S.6), billing usage view, suspended-tenant holding page, lifecycle state transitions.

- **B14 · EPIC-AB platform-operator admin** — operator sign-in (distinct route, mandatory 2FA), system-health dashboard, tenant directory, per-tenant detail with impersonation, billing oversight, sub-processor list, cross-tenant audit log, feature-flag rollout, incidents log, pack-cancellation queue.

- **B15 · EPIC-AE platform marketing site** — the operator's own marketing site (distinct visual identity from tenant-facing product). Home, product, features-by-pack, **pricing** (the pack catalogue and tier comparison from `PRODUCT.md` §5), customer stories, knowledge hub, trust + sub-processors (live from EPIC-AB) + status, public roadmap, comparison pages.

- **Final phase · Quality gates + cross-shell E2E** — all twelve CI guards G1–G12 fully wired with their canonical-violation fixtures; cross-shell happy-path E2E tests combining public catalogue + tenant admin + customer account + portal; the regression harness accumulating one assertion per shipped ticket.

### Deferred (not Sprint 01–04 scope)

- **EPIC-V outbound portal syndication** — `portal_syndication` pack. Phase 7 of the master spec roadmap.
- **EPIC-X bulk import** — `bulk_import` pack. Phase 8 of the master spec roadmap.

Brief these as DEFERRED in `audit/audit-report.md` updates; do not implement.

For each phase: satisfy the dev brief's acceptance criteria and test mapping; build each screen to match its canvas artefact at every breakpoint; emit audit-log rows on state changes; gate pack-dependent surfaces with the §2a patterns; resolve open questions with the most defensible choice and **document the decision** in an ADR under `docs/adr/`.

═══════════════════════════════════════════════════════════════
DEFINITION OF DONE (per epic)
═══════════════════════════════════════════════════════════════

A piece of work is done when **every** item below holds. Per-brief acceptance criteria layer on top.

- Every FR has a passing test (RED committed before GREEN); coverage gate met per `_tdd-protocol.md` §5.
- Every screen matches its `design/canvas/` artefact and passes visual-regression at all seven breakpoints (G11).
- No raw hex / px / ms / easing values (G7); AA contrast at every breakpoint + keyboard + screen-reader (G9); state-changing actions audit-logged (G4); personal-data forms carry GDPR consent (G5); pack-dependent code consults entitlement helper (G12); canonical naming respected (G6).
- Trust markers present where required (price qualifiers adjacent to prices, "indicative only" on valuation widgets and calculators, rent frequency on every rent figure — per `PRODUCT.md` §8).
- Performance budget met for affected routes at mobile and desktop simulated profiles (G3).
- PR description references the brief IDs closed and the audit-report row IDs resolved.
- `AGENTS.md` PR-checks all green; PR-has-tests guard satisfied (G1); coverage threshold met (G2); sub-processor-manifest guard satisfied (G10) if new external dependencies introduced.
- Documented for engineers (in-repo) and, where it affects staff workflow, in the admin help content.

═══════════════════════════════════════════════════════════════
PROGRESS REPORTING
═══════════════════════════════════════════════════════════════

After each phase, append a structured block to `audit/master-prompt-log.md`:

```
## Phase BX — <name>
Status: complete / blocked
PR: <url>
Branch: <branch>
Tests added: N
Coverage Δ: +X%
Drift items resolved: list of audit-report row IDs
New items shipped: list of brief IDs
Design canvas artefacts referenced: list of files
Pack-state branches added: list
Blockers encountered + resolution:
Token spend rough estimate:
```

═══════════════════════════════════════════════════════════════
BLOCKER POLICY (`AGENTS.md` §6)
═══════════════════════════════════════════════════════════════

When you hit a blocker you can't resolve from the foundation (broken CI you can't diagnose, ambiguous spec / design, missing infrastructure credential, third-party API shape unknown):

1. Commit progress on the phase branch.
2. Write the blocker to `audit/master-prompt-log.md` with enough detail for a human (or a future autonomous session) to resume.
3. Continue with the next independent phase if possible — don't halt the whole sprint.
4. If the blocker is foundation-level (Step 2 scaffold incomplete, stack unrecorded), pause subsequent phases that depend on it but proceed with any independent work.

**Never invent** a stack, product behaviour, design token, or naming convention to unblock — ASK the user, or log the blocker and move on. Inventing creates drift between code and requirements that takes weeks to recover.

If TDD itself is the blocker (a third-party API shape is genuinely unknown and writing a meaningful failing test first is impossible): follow `_tdd-protocol.md` §9 — spike → delete spike → restart with TDD. **Spike code is never merged.**

═══════════════════════════════════════════════════════════════
FILES YOU MUST NOT TOUCH WITHOUT EXPLICIT INSTRUCTION (`AGENTS.md` §7)
═══════════════════════════════════════════════════════════════

- `PRODUCT.md` — naming conventions, tier model, pack catalogue and compliance regime are business decisions.
- `DESIGN.md` — design tokens are owned by design; additions only via amendment.
- `motion-spec.md` — motion tokens owned by design.
- `design-requirements.md` — universal mandates owned by design + product.
- `Property-Agency-Website-Implementation-Spec.md` — the master spec is the input to your work, not the output.
- Any file under `audit/` other than `master-prompt-log.md` and `audit-report.md` (which you maintain).
- Any of the 31 brief files under `dev-briefs/v1/` or `design-briefs/v1/` — these are the spec; if they're wrong, raise an amendment, don't edit silently.

═══════════════════════════════════════════════════════════════
START NOW
═══════════════════════════════════════════════════════════════

1. **STEP 0 discovery** — read 0a through 0g in order. Build the mental model. Do not write code yet.
2. **STEP 1 stack confirmation** — if `AGENTS.md` §1 / §9 (or `STACK.md`) doesn't record every item in the list, **ASK** the user once, presenting the capability frame from master spec §P and the hosting frame from §S.13. Wait for the answer. Record it. **Do not commit application code until recorded.**
3. **STEP 2 scaffold** — workspace layout per the structure above, all six foundation packages with G1–G12 wired and failing-closed.
4. **PHASE B1 onwards** — proceed in dependency order. One PR per phase. TDD discipline. Build to the design canvas at every breakpoint.

The design canvas is your visual contract — build to it, test against it, and do not drift from it without a logged amendment to `DESIGN.md` and a paired update to the canvas.

— end of dev Claude prompt —
