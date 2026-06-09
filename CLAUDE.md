# CLAUDE.md — Conventions for AI agents working on this repo

This file is read by AI coding agents (Claude, other tools that follow the convention) to discover the rules of engagement before doing any work.

## 1. Current repo state

This repo is **in the requirements-foundation phase**. No code exists. No stack is committed.

- `Property-Agency-Website-Implementation-Spec.md` is the single source of truth for what the platform must do.
- `PRODUCT.md`, `DESIGN.md`, `motion-spec.md`, `design-requirements.md` carry the cross-cutting rules.
- `dev-briefs/v1/` carries the per-epic dev briefs.
- `design-briefs/v1/` carries the per-epic design briefs.
- `dev-briefs/sprint-01/_cross-cutting.md` carries the migration, shared-package and PR-sequencing rules for the current sprint.
- `dev-briefs/sprint-01/_tdd-protocol.md` carries the TDD discipline.

When a stack is chosen and code begins, add per-app `CLAUDE.md` files under each workspace (e.g. `apps/web/CLAUDE.md`, `services/api/CLAUDE.md`, `packages/shared/CLAUDE.md`) with stack-specific conventions.

## 2. Standing instructions for AI agents

### Do not invent a stack.

The technology choices have not been made. Do not commit to a framework, language, database product, ORM, hosting provider, payment processor, email service, mapping provider, error monitoring tool, analytics tool or CI tool without explicit direction. Section P of the master spec lists the *capabilities* the stack must provide; the agent's role until further notice is to keep requirements implementation-neutral.

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

### Architecture pattern — single-stack TypeScript monorepo

The product is built as **one Next.js application** with **Payload CMS** mounted inside it, sharing one database, one design system, one auth layer, and one deployment.

- **A single Next.js (App Router, TypeScript) application** serves every surface: the public marketing site, the platform marketing site, the tenant admin, the operator admin, customer accounts, the vendor / landlord / tenant portals, the CRM, the repair flow, the feedback flow, the property catalogue and detail.
- **Payload CMS 3.x** is mounted INSIDE the same Next.js app at `/admin/cms`. It provides the page-builder (block schemas + React renderers), the editorial admin UI, version history, scheduled publish, rich-text editing (Lexical) and the content collections that back the CMS-managed public surfaces.
- **Workers** run as a separate process (the same TypeScript codebase, different entrypoint) consuming a BullMQ queue on the shared Redis.
- **Auth is unified**: Better Auth issues a session cookie that carries the tenant identifier. The same Next.js app reads it from every Server Action, route handler, and Payload access function.

There is no separate backend API service. Server-side logic lives in Next.js Server Actions, route handlers, and Payload's auto-generated REST/GraphQL endpoints (used by the CMS admin and any external integrations).

### Per-surface stack ownership

Every surface ships from the same Next.js + Payload application. The "owning stack" column records which mechanism inside that app each surface uses.

| Surface | Owning mechanism |
|---|---|
| EPIC-C public marketing site | Next.js public routes + Payload Blocks (page-builder content) |
| EPIC-AE platform marketing site | Next.js public routes + Payload Blocks (distinct theme preset; see EPIC-AE design brief) |
| EPIC-D page-builder (the content authoring admin) | Payload CMS admin (mounted at `/admin/cms`); block schemas in `apps/web/payload/blocks/*` rendered by React components in `apps/web/components/blocks/*` |
| EPIC-F property catalogue + detail | Next.js Server Components + Prisma queries (interactive search, filters, gallery) |
| EPIC-H tenant admin | Next.js (Server Components + Server Actions) |
| EPIC-AB operator admin | Next.js on a separate subdomain; distinct visual identity |
| EPIC-T customer accounts | Next.js |
| EPIC-Y / Z / AA vendor / landlord / tenant portals | Next.js (magic-link auth via Better Auth) |
| EPIC-I CRM | Next.js (queue + slide-over + composer) |
| EPIC-G repair flow | Tenant form, admin inbox, contractor portal — all Next.js |
| EPIC-N auth foundation | Better Auth (OAuth + magic-link + WebAuthn) |
| EPIC-O SEO | Next.js metadata API + sitemap route; structured data emitted from Server Components |
| EPIC-U background workers | BullMQ on Redis; TypeScript worker entrypoint in `apps/workers` |
| EPIC-J data + EPIC-K capabilities | Prisma + Server Actions; complex client queries via tRPC (TBD per ADR-0002) |
| EPIC-AC feedback flow | Next.js (form + moderation queue) |
| EPIC-AD pack entitlement | Server Actions wrapper + middleware; `<RequirePack>` React component |
| EPIC-S multi-tenancy | Shared PostgreSQL + Row-Level Security; tenant resolution in Next.js middleware; Prisma extension issues `SET LOCAL app.current_tenant_id` per request |

### Foundation stack

| Layer | Choice |
|---|---|
| **Runtime** | Node.js LTS (currently 22.x) |
| **Framework** | Next.js **16** (App Router) with TypeScript — strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Pinned to `^16.2.6` for Payload CMS 3.x compatibility (Payload's Next peer range excludes 15.5.x — amended from 15.x; see audit D-021). Built/served with the **webpack** bundler (`next build/dev --webpack`); Turbopack is opted out because Payload's `withPayload` injects a webpack config. The route-interception file uses Next 16's `proxy.ts` convention (formerly `middleware.ts`). |
| **CMS** | Payload CMS 3.x (currently 3.85.0) — mounted INSIDE the Next.js app at `/admin/cms`. Code-first config (collections, fields, access control in TS files). Blocks field type for page-builder. Lexical for rich text. |
| **Data fetching / mutations** | React Server Components for reads; Server Actions for mutations; tRPC for complex client-side interactive queries (TBD per ADR-0002 — Server Actions only, vs Server Actions + tRPC) |
| **UI / styling** | CSS custom properties from `design/canvas/tokens.css` ported verbatim into `packages/tokens`; Tailwind CSS as the utility layer (configured to use the token CSS variables); no raw hex / px / ms per CI guard G7 |
| **Component library** | First-party — built from the EPIC-L canvas artefacts in `packages/ui`. No third-party UI kit (preserves design fidelity per G7) |
| **Database** | PostgreSQL 16 + PostGIS |
| **ORM** | Prisma. Schema lives in `packages/db/schema.prisma`. Raw SQL migrations under `packages/db/migrations/raw/` for: PostGIS extension, RLS policies, custom indexes, materialized views. Prisma extension wraps every query to issue `SET LOCAL app.current_tenant_id = '<uuid>'` from the request context. |
| **Authentication** | Better Auth. OAuth providers (Microsoft / Google / Apple) for staff sign-in. Magic-link for vendor / landlord / tenant portals. WebAuthn for staff 2FA. Session cookie carries the tenant identifier. |
| **Background jobs** | BullMQ on Redis. Workers run as a separate `apps/workers` process (same TS codebase, different entrypoint). Same Redis serves the BullMQ queue and the Next.js cache. |
| **Object storage** | **Local filesystem** on the host, behind a `StorageBackend` interface (`packages/storage`). V1 default; no S3 dependency. Files served through a signed-URL route handler (no pre-signed S3 URLs). The interface allows swapping to S3-compatible (MinIO / R2 / S3) later without touching feature code. |
| **CDN** | Cloudflare **free tier** in front of the origin — DDoS protection + edge cache only. No Workers, no analytics, no paid features. |
| **Image processing** | `sharp` (Next.js's built-in image-optimization library). Payload uses `sharp` for the CMS image renditions; persisted to the local-filesystem storage backend. |
| **Transactional email (tenant)** | **Per-tenant SMTP** via `nodemailer`. Each tenant configures their own SMTP from the admin: host, port, username, password (encrypted at rest using AES-256-GCM via Node's `crypto`, key from env), from-address, reply-to. Must support both **basic-auth with app passwords** and **OAuth 2.0** for Office 365 / Microsoft 365 (via Microsoft Graph) and Google Workspace / Gmail (via Google API). The platform never holds tenant credentials in plaintext. |
| **Transactional email (operator)** | **Configurable operator SMTP** via `nodemailer`. The platform operator configures their own SMTP at install time via env. Supported targets: Office 365 / Google Workspace / Gmail / self-hosted SMTP (Postfix, Maddy, Postal) / Postmark / Mailgun / any RFC-5321-compliant SMTP. Used for operator-to-tenant emails (welcome, billing, sub-processor change notification, password reset, support correspondence). Tenants never see this account. |
| **Email templates** | React Email — component-based, type-safe templates compiled to HTML at send time. Source files in `packages/email/templates/*.tsx`. |
| **SMS** | Twilio (no realistic self-hosted alternative — carrier agreements required). Used for emergency repair tickets and optional staff 2FA fallback. Low volume by design. |
| **Mapping** | **Per-tenant choice between Google Maps and Mapbox.** Each tenant provides their own API key from the admin. `MapBackend` interface in `packages/ui`; both implementations ship in the same package, runtime-selected per-tenant. A tenant on Starter can begin with Mapbox's free tier; an enterprise tenant can pick Google Maps for their existing licence. |
| **Anti-spam / challenge-response** | Cloudflare Turnstile (free tier; privacy-friendly; replaces reCAPTCHA). Token captured client-side, verified server-side on every form submission per CI guards G5 + G8. |
| **Form validation** | Zod schemas in `packages/validators` — shared between client (React Hook Form + Zod resolver) and server (Server Action validation). Type inference gives end-to-end safety. |
| **Rich text** | Lexical (Meta's open-source framework, built into Payload's rich-text field type). |
| **Date / time** | `date-fns` (tree-shakeable, immutable). Server-side dates stored as UTC; rendered in the tenant's configured timezone. |
| **Analytics** | **Deferred from V1.** No analytics layer in initial release. Add behind an interface later if commercial decision warrants. |
| **Error monitoring** | **Deferred from V1.** Structured logging only — JSON to stdout, captured by the Docker logging driver. A Sentry-compatible backend (GlitchTip self-hosted or Sentry hosted) can be wired later behind an `ErrorReporter` interface in `packages/observability`. |
| **Structured logging** | `pino` with JSON output to stdout per container, captured by the Docker logging driver. Optional aggregation to Loki + Grafana (self-hosted on the same Hetzner box) deferred from V1. |
| **Billing** | Stripe (subscriptions for tier + metered usage records for per-pack billing per EPIC-AD). Stripe is the only practical choice for regulated card processing. |

### Hosting model

Per master spec §S.13, the **pure-self-hosted** model is committed.

| Layer | Hosting |
|---|---|
| Next.js + Payload app (`apps/web`) | Hetzner dedicated server (AX or CCX class), Dockerised, deployed via Coolify or Dokku |
| Workers (`apps/workers`) | Same Hetzner server, separate Docker container (same image, different entrypoint) |
| PostgreSQL 16 + PostGIS | Hetzner-hosted on the same dedicated server. Schema-management via Prisma Migrate; PostGIS extension + RLS policies + custom indexes in raw SQL migrations under `packages/db/migrations/raw/`. |
| Redis | Hetzner-hosted on the same dedicated server (BullMQ queue + Next.js cache). |
| Object storage | **Local filesystem** on the Hetzner host. Backed up via `restic` to a separate Hetzner Storage Box. No S3 dependency. |
| Cloudflare CDN | Cloudflare free tier (DDoS + edge cache). |
| Email (tenant) | Per-tenant SMTP — tenant brings their own (Office 365 / Gmail / any SMTP) configured in the admin. |
| Email (operator) | Configurable SMTP — operator picks Office 365 / Google Workspace / self-hosted / Postmark / Mailgun at install time. |
| SMS | Twilio (one provider account at the operator level; usage accounted per-tenant for billing). |
| Region | UK / EU only (per master spec §S.7 data residency requirement). Hetzner's Falkenstein, Nuremberg or Helsinki data centres satisfy. |
| Backup target | Hetzner Storage Box (separate physical box, cheap, EU-region) — daily `pg_dump` + local-filesystem `restic` snapshot. |

### CI/CD

| Layer | Choice |
|---|---|
| CI / CD provider | GitHub Actions |
| Deployment | Docker image built in CI, pushed to GitHub Container Registry, Coolify pulls on tag. One image runs both the `apps/web` and the `apps/workers` containers (different `CMD`). |
| IaC | Terraform for Cloudflare resources (DNS, CDN config); Docker Compose for Hetzner-hosted services; `cloudflared` tunnel for local dev |
| Secrets | SOPS + age encrypted secrets committed to the repo; decryption keys live in GitHub Actions secrets at deploy time |

### Testing stack

| Layer | Choice |
|---|---|
| Unit + integration | Vitest + React Testing Library |
| End-to-end | Playwright |
| Visual regression | Playwright with `@playwright/test` + per-breakpoint screenshots per the canvas's `responsive-coverage.json` |
| Database integration | Vitest against a per-test transactional Postgres via Testcontainers (transactional rollback per test) |
| Accessibility automation | `@axe-core/playwright` (G9) |
| Performance budget | Lighthouse CI per route (G3) |
| Coverage | Vitest coverage; combined report in CI |
| Type safety | `tsc --noEmit` in CI; `prisma generate` + `payload generate:types` checked in |

### Workspace layout (concrete)

```
apps/
  web/                    ← Next.js (App Router) + Payload CMS mounted at /admin/cms
                            Serves every user-facing surface:
                            - public marketing site
                            - platform marketing site
                            - tenant admin
                            - operator admin
                            - customer accounts
                            - vendor / landlord / tenant portals
                            - CRM, repair flow, feedback flow
                            - property catalogue + detail
  workers/                ← BullMQ worker process (same TS codebase, different entrypoint)
packages/
  tokens/                 ← design tokens (one source of truth; emits CSS custom properties + TS export)
  ui/                     ← React component library — the EPIC-L primitives ported from the design canvas
  db/                     ← Prisma schema, generated client, raw SQL migrations for PostGIS / RLS / indexes
  auth/                   ← Better Auth config + multi-tenant access helpers + RBAC role definitions
  validators/             ← Zod schemas shared between client and server
  email/                  ← React Email templates + SMTP send abstraction + per-tenant credential resolver
  storage/                ← StorageBackend interface (local-filesystem default; S3/MinIO/R2 swappable)
  observability/          ← pino logger + ErrorReporter interface (deferred Sentry/GlitchTip swap)
  entitlement/            ← isPackEnabled / requirePack / <RequirePack> wrappers
  config/                 ← shared lint, format, CI, tsconfig, eslint, vitest preset
infrastructure/           ← Terraform (Cloudflare), Docker Compose (Hetzner), Coolify manifests
docs/
  adr/                    ← architectural decision records
  runbooks/               ← provisioning, restore, suspend, rotate-secrets, incident response
```

Monorepo tool: **Turborepo** (or pnpm workspaces alone if a single tool suffices). All `apps/*` and `packages/*` are TypeScript packages sharing one `tsconfig` base. One `package.json` lockfile at the root.

### Multi-tenancy implementation

- **Shared PostgreSQL + Row-Level Security.** One database, every tenant-owned table carries a `tenant_id` column, RLS policies enforce isolation at the data layer.
- Per-request Next.js middleware resolves the tenant by subdomain or custom-domain hostname, attaches the tenant identifier to the request context.
- A **Prisma Client extension** (`packages/db/extensions/tenant-rls.ts`) wraps every query and issues `SET LOCAL app.current_tenant_id = '<uuid>'` before the actual query runs, on the same transaction. RLS policies reference `current_setting('app.current_tenant_id')::uuid`.
- The Better Auth session cookie carries the tenant identifier (set when the user signs into a tenant subdomain). Every Server Action, route handler, and Payload access function reads the tenant from the session and reapplies the GUC server-side.
- Payload CMS access functions are configured to scope every collection to the current tenant — content authors only see their own tenant's pages, blocks, media.
- Cheapest to operate (one DB, one migration run, one backup, one connection pool); fastest to provision (INSERT a tenant row — sub-second, hitting the 10-minute target with room to spare); strongest fit for the modular cost goal in master spec §S.2.
- Operator admin is on a separate subdomain (`admin.estateplatform.co.uk` or equivalent) and is NOT a tenant — it spans tenants and uses a distinct authorisation scope. Operator queries bypass tenant RLS via a privileged Postgres role used only by audited operator-admin handlers.
- Per-tenant backup uses row-filtered `pg_dump` (`pg_dump --where="tenant_id='...'"`). Per-tenant restore is a documented runbook procedure under `docs/runbooks/`.
- Enterprise-tier tenants requesting dedicated database isolation are promoted via a documented migration (`pg_dump` → new dedicated DB → swap `DATABASE_URL`). The shared-DB-with-RLS default covers Starter and Professional.

### Pack entitlement implementation (EPIC-AD)

- `enabled_packs` stored on the tenant model as JSONB.
- `isPackEnabled(pack_slug)` helper in `packages/entitlement/index.ts` reads the current tenant's enabled packs from the session.
- `requirePack("sales_plus")` Server Action wrapper that throws if the pack is not enabled.
- `<RequirePack pack="sales_plus">…</RequirePack>` React Server Component for route-level gating.
- Payload CMS access functions gate pack-scoped content collections via the same helper.
- CI guard G12 enforces these wrappers via a custom ESLint rule.

### Notes on what is intentionally NOT chosen here

- **Server Actions only vs Server Actions + tRPC** for client-side interactive queries — confirmed before EPIC-K scaffold.
- **Turborepo vs pnpm workspaces alone** as the monorepo orchestrator — confirmed before B0 scaffold.
- **Backup target box specifics** (Hetzner Storage Box vs an off-Hetzner provider for true geo-separation) — confirmed before first paying tenant.

These three open decisions are documented as ADRs `docs/adr/0001-data-fetching.md`, `docs/adr/0002-monorepo-tool.md`, `docs/adr/0003-backup-target.md` and resolved before scaffolding the affected module.

### Reasons-for-choice (defensible record)

- **Next.js end-to-end** — single language (TypeScript), single deployment, single log stream, single connection pool. Removes the cross-language API seam and halves the type/schema/validator surface area. The design canvas (static HTML + CSS) ports directly into React components.
- **Payload CMS 3.x** — strongest TypeScript-native page-builder available. Mounts INSIDE the Next.js app at a route — one Docker image, one DB connection pool. Code-first config (collections, fields, access control all in TS files in the repo, code-reviewed, versioned). MIT licence, Series A funded in 2024 (Forerunner Ventures), Postgres-native, themable admin UI, Lexical for rich text. The `Blocks` field type is the TypeScript equivalent of Wagtail StreamField: each block has a TS schema plus a React render component, ported one-for-one from the design canvas.
- **Prisma** — most mature TS ORM, excellent tooling (Studio for tenant-aware data browsing in dev, Migrate for schema management). Well-trodden multi-tenant + RLS pattern via Client extensions. Generates types end-to-end into the rest of the codebase.
- **Better Auth** — TS-native, magic-link out of the box (for vendor / landlord / tenant portals), WebAuthn out of the box (for staff 2FA), OAuth providers (Microsoft / Google / Apple) built in, multi-session and multi-tenant primitives. MIT licence, fully self-host. Cleaner shape than NextAuth/Auth.js for our requirements.
- **BullMQ on Redis** — fully self-host, mature (built on top of `ioredis`), no SaaS dependency. Same Redis serves the cache and the queue. Strong observability via the BullMQ Board admin UI.
- **React Email** — component-based templates with type-safe variables, rendered to HTML at send time. Lives alongside the rest of the React code; one mental model.
- **Lexical** — Meta's open-source rich-text framework, built into Payload's rich-text field type. Excellent extensibility, strong accessibility, used in Facebook/Instagram production.
- **Zod for validation** — shared schemas between client and server. Type-inference gives end-to-end safety. Pairs cleanly with React Hook Form on the client and Server Action validation on the server.
- **PostgreSQL + PostGIS** — property-search radius queries require spatial; PostGIS is the canonical fit.
- **Shared DB + Row-Level Security** — cheapest to operate, fastest to provision (sub-second per tenant), hits the 10-minute target with room to spare. Used in production by Supabase, Linear, Vercel and many modern B2B SaaS. PostgreSQL RLS is mature and well-trodden.
- **Local-filesystem object storage** — zero per-byte storage cost, no third-party dependency, simplest backup model (one `restic` job covers all media). The `StorageBackend` abstraction preserves the option to swap to S3-compatible later if horizontal scaling becomes required.
- **Cloudflare free tier for CDN** — DDoS protection and edge cache for free; processing happens on the Hetzner origin, Cloudflare never sees user data unencrypted.
- **Per-tenant SMTP (Outlook / Office 365 / Gmail / any) via `nodemailer`** — tenants send email from their own brand identity at their own domain reputation. The platform never pays for outbound deliverability. OAuth 2.0 support handles Office 365 / Gmail's basic-auth deprecation. Credentials encrypted at rest using AES-256-GCM via Node's `crypto` (no extra dependency).
- **Configurable operator SMTP** — the platform operator picks their preferred sending account at install time. Configuration is per-deployment, not per-tenant.
- **Twilio for SMS** — no self-hosted alternative exists (carrier agreements required). Twilio's UK SMS pricing is acceptable for emergency-repair use only (low volume).
- **Per-tenant Google Maps OR Mapbox** — tenants bring their own API key; the platform pays no map fees. Either provider's free tier covers a small agency.
- **Cloudflare Turnstile** — free, privacy-friendly, no cookie-consent banner complications, replaces reCAPTCHA.
- **Stripe for billing** — only practical choice for regulated card processing; the per-pack metered-overage model in EPIC-AD maps cleanly to Stripe's metered billing primitives.
- **Hetzner dedicated server with Docker + Coolify** — cost target in master spec §S.2 is significantly easier to hit with dedicated hardware, and the data-residency requirement in §S.7 is satisfied by Hetzner's EU regions. Coolify provides a tenant-operator-friendly deployment UI.
- **GitHub Actions** — most teams already know it, runs anywhere (including a self-hosted runner on the same Hetzner box).
- **SOPS + age for secrets** — encrypted secrets committed to the repo; no third-party secrets manager to run. Decryption keys live in GitHub Actions secrets at deploy time.
- **Error monitoring deferred** — structured logging is sufficient for V1. Sentry-compatible error reporting added behind an interface later if needed.

Until any of the three "intentionally not chosen" items above is committed, the dev Claude must not commit code that depends on the unresolved choice.
