# AGENTS.md — Conventions for AI agents working on this repo

This file is read by AI coding agents (Codex, other tools that follow the convention) to discover the rules of engagement before doing any work.

## 1. Current repo state

This repo has **moved into the build phase**. The stack is now chosen and recorded in §9 below — application code may be committed. (The requirements foundation below remains the source of truth for *what* to build.)

- `Property-Agency-Website-Implementation-Spec.md` is the single source of truth for what the platform must do.
- `PRODUCT.md`, `DESIGN.md`, `motion-spec.md`, `design-requirements.md` carry the cross-cutting rules.
- `dev-briefs/v1/` carries the per-epic dev briefs.
- `design-briefs/v1/` carries the per-epic design briefs.
- `dev-briefs/sprint-01/_cross-cutting.md` carries the migration, shared-package and PR-sequencing rules for the current sprint.
- `dev-briefs/sprint-01/_tdd-protocol.md` carries the TDD discipline.

When a stack is chosen and code begins, add per-app `AGENTS.md` files under each workspace (e.g. `apps/web/AGENTS.md`, `services/api/AGENTS.md`, `packages/shared/AGENTS.md`) with stack-specific conventions.

## 2. Standing instructions for AI agents

### Do not invent a stack.

The technology choices **have now been made and are recorded in §9**. Do not substitute a different framework, language, database product, ORM, hosting provider, payment processor, email service, mapping provider, error-monitoring tool, analytics tool or CI tool without an amendment PR against §9. Section P of the master spec lists the *capabilities* the stack provides; three decisions remain open as ADRs (see §9 "intentionally NOT chosen") and code depending on them must wait until each ADR is resolved.

### Do not invent product behaviour.

If something is not stated in the master spec or in a brief, ask before implementing. Inventing behaviour silently creates drift between code and requirements that takes weeks to recover.

### Follow PRODUCT.md naming literally.

The canonical-noun table is enforced by lint. Code that names entities differently fails CI. Conversational copy uses the UI-vocabulary table.

### Follow DESIGN.md tokens literally.

No raw hex, no raw px, no raw ms. Every visual value references a token. New tokens require a documented amendment to `DESIGN.md`.

### Follow motion-spec.md for any animation.

Same rule. No magic durations or easings.

### TDD is mandatory.

Read `dev-briefs/sprint-01/_tdd-protocol.md` before writing any code. The RED step is committed separately from the GREEN step. The PR-has-tests CI guard rejects implementation-only diffs.

### Audit-log every state-changing action.

The audit-log-coverage CI guard rejects any state-changing capability that doesn't emit an `audit_logs` row.

### GDPR consent is captured at every personal-data form.

The compliance lint rejects any form schema that captures personal data without a consent affirmation.

### Performance budgets are enforced in CI.

The performance-budget gate rejects any route whose JavaScript or CSS bundle exceeds the budget in `design-requirements.md` section 3.

## 3. Brief-driven work

When the autonomous build prompt runs, every ticket the agent picks up corresponds to a brief under `dev-briefs/v1/<EPIC-ID>.md`. The brief states:

- What the feature is, with reference to the master spec section.
- The functional requirements as numbered FR statements.
- The user stories (As / I want / So that).
- The acceptance criteria.
- The test mapping (what tests, where, what assertions).
- The dependencies on other epics.
- The open questions to resolve before starting.

The matching `design-briefs/v1/<EPIC-ID>.md` carries the visual and interaction specification for the same scope.

The agent's job is to satisfy the brief, not to invent beyond it.

## 4. Working folder layout (when code arrives)

When the stack is chosen, the recommended folder layout is:

```
apps/                     ← user-facing applications
  web/                    ← public marketing site + customer accounts
  admin/                  ← admin dashboard (if separated)
  mobile/                 ← future
services/                 ← back-end services (if separated from apps)
  api/                    ← primary platform API
  workers/                ← background-job workers
packages/                 ← shared code
  types/                  ← shared type definitions
  validators/             ← shared input validation schemas
  ui/                     ← shared UI component library
  config/                 ← shared lint, format and CI rules
  email-templates/        ← shared email-template source
infrastructure/           ← IaC, deployment definitions (added when stack is chosen)
docs/                     ← architecture decisions, runbooks
```

The autonomous prompt's PHASE discovery uses this layout. If the stack chosen mandates a different layout, document the deviation in this file before starting.

## 5. PR conventions

### Branch naming

- Foundation / phase branches: `chore/phase-<letter>-<scope>` (e.g. `chore/phase-b-foundation`).
- Ticket branches inside a phase: `<type>/<EPIC-ID>-<short-slug>` (e.g. `feat/EPIC-G-tenant-repair-form`).
- Bugfix branches: `fix/<EPIC-ID>-<short-slug>`.

### Commit messages

Conventional Commits. One of `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`. Each phase produces at least three commits: `test()` for RED, `feat()` for GREEN, `refactor()` for clean-up (omit if no refactor was needed).

Include a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer (or the actual model identifier of whichever AI assisted) on commits where an AI contributed substantively.

### PR shape

One PR per phase as described in the autonomous build prompt. PR description must reference the brief IDs being closed and the audit-report row IDs being resolved.

### PR checks (when CI is set up)

- Type-check passes.
- Lint passes (including the project-specific lint rules described in `dev-briefs/sprint-01/_cross-cutting.md`).
- All tests pass.
- Coverage threshold met (per `_tdd-protocol.md` section on coverage gates).
- Performance budget met for affected routes.
- PR-has-tests guard satisfied (no implementation diff without test diff).
- Audit-log-coverage guard satisfied for any new state-changing capability.

## 6. When the agent is blocked

Follow the blocker policy in the autonomous build prompt:

1. Commit progress on the phase branch.
2. Write the blocker to `.claude/master-prompt-log.md` with enough detail for a human to resume.
3. Continue with the next phase if possible.
4. Pause subsequent phases that depend on a foundation-level blocker.

## 7. Files the agent must not touch without explicit instruction

- `PRODUCT.md` (naming conventions and tier model are business decisions).
- `DESIGN.md` (design tokens are owned by design — additions only via amendment).
- The master spec `Property-Agency-Website-Implementation-Spec.md` (requirements are the input, not the output, of the agent's work).
- Any file under `.claude/` other than `master-prompt-log.md` and `discovery-summary.md`.

## 8. Notes on AI-generated content

- Any user-facing copy generated by an AI assistant must be reviewed by a human before shipping.
- Any AI-generated property description shown to end-users must be flagged on the admin side per `PRODUCT.md` section 8.
- AI-generated test data (seed scripts) is fine to ship without review, but must use deterministic fixtures so that re-runs are stable.

## 9. Stack — RECORDED

The stack has been chosen. Code may now be committed. The choices below are the **authoritative** answers; subsequent additions or substitutions require an amendment PR against this file.

### Architecture pattern — hybrid two-stack

The product is built as two cooperating applications sharing one database and one design system:

- **A Django + Wagtail "content" application** serving the content-heavy surfaces (public marketing site, agency editorial content, CMS page builder, knowledge hub, the platform's own marketing site).
- **A Next.js "app" application** serving the highly interactive surfaces (tenant admin, operator admin, customer accounts, vendor / landlord / tenant portals, CRM, repair flow, feedback flow, property catalogue and detail).

The two communicate over a JSON API exposed by the Django side. Auth is unified: Django issues a session cookie; Next.js forwards it to the API on every request.

### Per-surface stack ownership

| Surface | Owning stack |
|---|---|
| EPIC-C public marketing site | Django + Wagtail (StreamField for editorial pages) |
| EPIC-AE platform marketing site | Django + Wagtail (distinct theme preset; see EPIC-AE design brief) |
| EPIC-D page-builder (the content authoring admin) | Wagtail StreamField — the content editor uses Wagtail admin |
| EPIC-F property catalogue + detail | Next.js (interactive search, filters, gallery) consuming the Django property API |
| EPIC-H tenant admin | Next.js |
| EPIC-AB operator admin | Next.js (distinct visual identity) |
| EPIC-T customer accounts | Next.js |
| EPIC-Y / Z / AA vendor / landlord / tenant portals | Next.js |
| EPIC-I CRM | Next.js (queue + slide-over + composer) |
| EPIC-G repair flow | Tenant form (Next.js); admin inbox (Next.js); contractor portal (Next.js) |
| EPIC-N auth foundation | Django (Django auth + django-allauth) |
| EPIC-O SEO | Both: Wagtail-native for Django pages, Next.js metadata APIs for Next.js pages |
| EPIC-U background workers | Celery (Python) + Redis |
| EPIC-J data + EPIC-K capabilities | Django models + Django Ninja (or DRF) API |
| EPIC-AC feedback flow | Next.js (form + moderation queue); Django backend |
| EPIC-AD pack entitlement | Shared via the API — Django evaluates, Next.js consults |
| EPIC-S multi-tenancy | Shared PostgreSQL + Row-Level Security; the Next.js side reads tenant context from the session |
| EPIC-AE platform marketing site | Django + Wagtail |

### Foundation stack

| Layer | Choice |
|---|---|
| **Backend framework** | Django (latest stable LTS) with Python 3.12+ |
| **CMS** | Wagtail (latest stable, paired with the chosen Django version) |
| **API layer** | Django Ninja (preferred for type-safety) or Django REST Framework — implementation team confirms before B2 (ADR 0001) |
| **Frontend framework (app side)** | Next.js (App Router) with TypeScript |
| **UI / styling** | CSS custom properties from `design/canvas/tokens.css` ported verbatim; Tailwind CSS as the utility layer (configured to use the token CSS variables); no raw hex / px / ms per CI guard G7 |
| **Component library (app side)** | First-party — built from the EPIC-L canvas artefacts. No third-party UI kit (preserves design fidelity per G7) |
| **Database** | PostgreSQL 16+ with PostGIS |
| **ORM (Django side)** | Django ORM |
| **ORM (Next.js side)** | None — the Next.js app does not touch the database directly; it consumes the Django API |
| **Object storage** | **Local filesystem** on the host, behind a `StorageBackend` interface. V1 default; no S3 dependency. Files served through a signed-token middleware (no pre-signed S3 URLs). The interface allows swapping to S3-compatible (MinIO / R2 / S3) later without touching feature code. |
| **CDN** | Cloudflare **free tier** in front of the origin — DDoS protection + edge cache only. No Workers, no analytics, no paid features. |
| **Image processing** | Wagtail's built-in renditions, persisted to the local-filesystem storage backend. |
| **Transactional email (tenant)** | **Per-tenant SMTP.** Each tenant configures their own SMTP server from the admin: host, port, username, password (encrypted at rest — ADR 0002), from-address, reply-to. Must support both **basic-auth with app passwords** and **OAuth 2.0** for Office 365 / Gmail / Outlook.com (which deprecated basic auth). Generic SMTP for everything else. The platform never holds tenant credentials in plaintext. |
| **Transactional email (operator)** | **Configurable operator SMTP.** The platform operator configures their own SMTP at install time. Supported targets: Office 365 / Google Workspace / Gmail / self-hosted SMTP (Postfix, Maddy, Postal) / Postmark / Mailgun / any RFC-5321-compliant SMTP server. Used for operator-to-tenant emails (welcome, billing, sub-processor change notification, password reset, support correspondence). Tenants never see this account. |
| **SMS** | Twilio (no realistic self-hosted alternative for SMS — carrier agreements required). Used for emergency repair tickets and optional staff 2FA fallback. Low volume by design. |
| **Mapping** | **Per-tenant choice between Google Maps and Mapbox.** Each tenant provides their own API key from the admin. `MapBackend` interface; both implementations ship in the shared UI package. A tenant on Starter can begin with Mapbox's free tier; an enterprise tenant can pick Google Maps for their existing licence. |
| **Anti-spam / challenge-response** | Cloudflare Turnstile (free tier; privacy-friendly; replaces reCAPTCHA). Token captured client-side, verified server-side on every form submission per CI guard G5 + G8. |
| **Analytics** | **Deferred from V1.** No analytics layer in initial release. Add behind an interface later if commercial decision warrants. |
| **Error monitoring** | **Deferred from V1.** Structured logging only — JSON to stdout, captured by the Docker logging driver. A Sentry-compatible backend (GlitchTip self-hosted or Sentry hosted) can be wired later behind an `ErrorReporter` interface. |
| **Structured logging** | JSON to stdout per container, captured by the Docker logging driver. Optional aggregation to Loki + Grafana (self-hosted on the same Hetzner box) deferred from V1. |
| **Background jobs** | Celery + Redis (Redis is also the cache layer). |
| **Billing** | Stripe (subscriptions for tier + metered usage records for per-pack billing per EPIC-AD). Stripe is the only practical choice for regulated card processing; no self-hosted alternative exists for the payment-processor role. |
| **Authentication** | Django auth + django-allauth for social providers (future); WebAuthn for staff 2FA via `django-otp` + `django-otp-webauthn`; magic-link auth for vendor / landlord / tenant portals via `django-sesame` |

### Hosting model

Per master spec §S.13, the **pure-self-hosted** model is committed.

| Layer | Hosting |
|---|---|
| Django + Wagtail app | Hetzner dedicated server (AX or CCX class), Dockerised, deployed via Coolify or Dokku |
| Next.js app | Same Hetzner server alongside Django, Dockerised, deployed via Coolify or Dokku |
| PostgreSQL 16 + PostGIS | Hetzner-hosted on the same dedicated server. Schema-management via Django migrations; RLS policies in raw SQL migrations. |
| Object storage | **Local filesystem** on the Hetzner host. Backed up via `restic` or `borg` to a separate Hetzner Storage Box. No S3 dependency. |
| Cloudflare CDN | Cloudflare free tier (DDoS + edge cache). |
| Redis | Hetzner-hosted on the same dedicated server (Celery broker + Django cache). |
| Email (tenant) | Per-tenant SMTP — tenant brings their own (Office 365 / Gmail / any SMTP) configured in the admin. |
| Email (operator) | Configurable SMTP — operator picks Office 365 / Google Workspace / self-hosted / Postmark / Mailgun at install time. |
| SMS | Twilio (one provider account at the operator level; usage accounted per-tenant for billing). |
| Region | UK / EU only (per master spec §S.7 data residency requirement). Hetzner's Falkenstein, Nuremberg or Helsinki data centres satisfy. |
| Backup target | Hetzner Storage Box (separate physical box, cheap, EU-region) — daily `pg_dump` + local-filesystem `restic` snapshot (ADR 0003). |

### CI/CD

| Layer | Choice |
|---|---|
| CI / CD provider | GitHub Actions |
| Deployment Django | Docker image built in CI, pushed to GitHub Container Registry, Coolify pulls on tag |
| Deployment Next.js | Same Docker + Coolify path as Django on the Hetzner host |
| IaC | Terraform for Cloudflare resources (DNS, CDN config); Docker Compose for Hetzner-hosted services; `cloudflared` tunnel for local dev |
| Secrets | SOPS + age (encrypted secrets in-repo); decryption keys in GitHub Actions secrets at deploy time |

### Testing stack

| Layer | Choice |
|---|---|
| Django unit + integration tests | pytest + pytest-django |
| Django property-based tests | hypothesis |
| Django API contract tests | schemathesis (against the Django Ninja / DRF schema) |
| Next.js unit + component tests | Vitest + React Testing Library |
| Next.js visual regression | Playwright with `@playwright/test` + per-breakpoint screenshots per the canvas's `responsive-coverage.json` |
| End-to-end across both stacks | Playwright with a per-test seed that exercises both Django and Next.js |
| Accessibility automation | `@axe-core/playwright` (G9) |
| Performance budget | Lighthouse CI per route (G3) |
| Coverage | pytest-cov for Django; Vitest coverage for Next.js; combined report in CI |

### Workspace layout (concrete)

```
apps/
  next/                   ← Next.js (App Router) — tenant admin, operator admin, customer + portals, CRM, repair flow, feedback, property catalogue/detail
services/
  django/                 ← Django + Wagtail — public marketing site, platform marketing site, CMS, page builder, API, auth foundation
  workers/                ← Celery worker processes (the same Django code, deployed with the worker entrypoint)
packages/
  tokens/                 ← design tokens (one source of truth; emits both CSS custom properties for Django and a TypeScript export for Next.js)
  ui-components/          ← Next.js / React component library — the EPIC-L primitives ported from the design canvas
  validators/             ← shared input validation schemas (Zod on the Next.js side; Pydantic on the Django side; both generated from one OpenAPI contract)
  api-client/             ← Next.js API client generated from the Django OpenAPI spec
infrastructure/           ← Terraform, Docker Compose, deployment manifests
docs/
  adr/                    ← architectural decision records
  runbooks/               ← provisioning, restore, suspend, rotate-secrets, incident response
```

### Multi-tenancy implementation

- **Shared PostgreSQL + Row-Level Security.** One database, every tenant-owned table carries a `tenant_id` column, RLS policies enforce isolation at the data layer.
- Per-request Django middleware resolves the tenant by subdomain or custom-domain hostname, then sets the Postgres session GUC `SET LOCAL app.current_tenant_id = '<uuid>'` before any query runs. RLS policies reference `current_setting('app.current_tenant_id')::uuid`.
- Cheapest to operate (one DB, one migration run, one backup, one connection pool); fastest to provision (INSERT a tenant row — sub-second, hitting the 10-minute target with room to spare); strongest fit for the modular cost goal in master spec §S.2.
- Next.js receives the tenant identifier in the session cookie issued by Django; every API call carries it and Django middleware re-applies the GUC server-side. The Next.js side never reads tenant data directly.
- Operator admin is on a separate subdomain (`admin.estateplatform.co.uk` or equivalent) and is NOT a tenant — it spans tenants and uses a distinct authorisation scope. Operator queries bypass tenant RLS via a privileged role used only by audited operator-admin handlers.
- Per-tenant backup uses row-filtered `pg_dump` (`pg_dump --where="tenant_id='...'"`). Per-tenant restore is a documented runbook procedure under `docs/runbooks/`.
- Enterprise-tier tenants requesting dedicated database isolation are promoted via a documented migration (`pg_dump` → new dedicated DB → swap `DATABASE_URL`). The shared-DB-with-RLS default covers Starter and Professional.

### Pack entitlement implementation (EPIC-AD)

- `enabled_packs` stored on the tenant model as a JSONB or text array.
- `isPackEnabled(pack_slug)` helper in both Django (`apps/entitlement/helpers.py`) and Next.js (`packages/api-client/entitlement.ts` consuming a `/api/tenant/me` endpoint).
- `@require_pack("sales_plus")` decorator for Django views / API routes.
- `<RequirePack pack="sales_plus">…</RequirePack>` component for Next.js routes.
- CI guard G12 enforces these wrappers across both codebases via a custom ESLint + flake8 rule.

### Notes on what is intentionally NOT chosen here

- **Django Ninja vs Django REST Framework** for the API layer — confirmed before B2.
- **Pre-tenant SMTP encryption library** (`django-cryptography` vs a custom helper) — confirmed before EPIC-H §H.12 ships.
- **Backup target box specifics** (Hetzner Storage Box vs an off-Hetzner provider for true geo-separation) — confirmed before first paying tenant.

These three open decisions are documented as ADRs `docs/adr/0001-api-framework.md`, `docs/adr/0002-smtp-credential-encryption.md`, `docs/adr/0003-backup-target.md` and resolved before scaffolding the affected module.

### Reasons-for-choice (defensible record)

- **Django + Wagtail for content** — Wagtail StreamField is the strongest page-builder paradigm available; rebuilding it first-party would be months of work for inferior result.
- **Next.js for app** — the interactive admin, portals and CRM benefit substantially from React's component model and Next.js's data-fetching primitives; the design canvas (static HTML + CSS) ports cleanly into React components.
- **PostgreSQL + PostGIS** — the property-search radius queries require spatial; PostGIS is the canonical fit.
- **Shared DB + Row-Level Security** — cheapest to operate, fastest to provision (sub-second per tenant), hits the 10-minute target with room to spare. Used in production by Supabase, Linear, Vercel and many modern B2B SaaS. PostgreSQL RLS is mature and well-trodden.
- **Local-filesystem object storage** — zero per-byte storage cost, no third-party dependency, simplest backup model (one `restic` job covers all media). The `StorageBackend` abstraction preserves the option to swap to S3-compatible later if horizontal scaling becomes required.
- **Cloudflare free tier for CDN** — DDoS protection and edge cache for free; processing happens on the Hetzner origin, Cloudflare never sees user data unencrypted.
- **Per-tenant SMTP (Outlook / Office 365 / Gmail / any)** — tenants send email from their own brand identity at their own domain reputation. The platform never pays for outbound deliverability. OAuth support handles Office 365 / Gmail's basic-auth deprecation.
- **Configurable operator SMTP** — the platform operator picks their preferred sending account at install time (Office 365, Google Workspace, self-hosted SMTP, Postmark, Mailgun). The configuration is per-deployment, not per-tenant.
- **Twilio for SMS** — no self-hosted alternative for SMS exists (carrier agreements required). Twilio's UK SMS pricing is acceptable for emergency-repair use only (low volume).
- **Per-tenant Google Maps OR Mapbox** — tenants bring their own API key; the platform pays no map fees. Either provider's free tier covers a small agency.
- **Cloudflare Turnstile** — free, privacy-friendly, no cookie-consent banner complications, replaces reCAPTCHA.
- **Stripe for billing** — only practical choice for regulated card processing; the per-pack metered-overage model in EPIC-AD maps cleanly to Stripe's metered billing primitives.
- **Hetzner dedicated server with Docker + Coolify** — cost target in master spec §S.2 is significantly easier to hit with dedicated hardware, and the data-residency requirement in §S.7 is satisfied by Hetzner's EU regions. Coolify provides a tenant-operator-friendly deployment UI.
- **GitHub Actions** — most teams already know it, runs anywhere (including a self-hosted runner on the same Hetzner box).
- **SOPS + age for secrets** — encrypted secrets committed to the repo; no third-party secrets manager to run. Decryption keys live in GitHub Actions secrets at deploy time.
- **Error monitoring deferred** — structured logging is sufficient for V1. Sentry-compatible error reporting (GlitchTip self-hosted or Sentry hosted) added behind an interface in Phase 7 if needed.

Until any of the three "intentionally not chosen" items above is committed, the dev agent must not commit code that depends on the unresolved choice.