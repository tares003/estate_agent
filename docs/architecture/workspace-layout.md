# Workspace layout

The repository is a **single-stack TypeScript monorepo**: one Next.js (App Router) application with **Payload CMS 3.x** mounted inside it, plus a sibling workers process running on the same TypeScript codebase. One PostgreSQL database, one design token source, one auth layer, one deployment image.

```
apps/
  web/                  Next.js (App Router, TypeScript) — serves every user-facing surface:
                        public marketing site, platform marketing site, tenant admin,
                        operator admin, customer accounts, vendor/landlord/tenant portals,
                        CRM, repair flow, feedback flow, property catalogue + detail.
                        Payload CMS is mounted at /admin/cms inside this app.
  workers/              BullMQ worker process (same image, different entrypoint).
                        Consumes the shared Redis queue for scheduled tasks, email send,
                        portal sync, bulk import, report generation, etc.
packages/               TypeScript shared packages (pnpm workspace members):
  config/               Lint/format/type-check/tsconfig/vitest preset + the 12 CI guards.
  tokens/               Design tokens (CSS custom properties + TS export).
  ui/                   First-party React component library — every EPIC-L primitive
                        ported from design/canvas/ (atoms, molecules, organisms,
                        pack-state, responsive variants at all 7 breakpoints).
  db/                   Prisma schema + generated client + raw SQL migrations
                        (PostGIS extension, RLS policies, custom indexes).
                        Prisma Client extension issuing SET LOCAL app.current_tenant_id
                        per request lives here.
  auth/                 Better Auth config (OAuth + magic-link + WebAuthn) +
                        RBAC role library (Super Admin, Branch Manager, Property Lister,
                        Lettings Negotiator, Sales Negotiator, Property Manager,
                        Content Editor, Read-Only + custom-role composition) +
                        multi-tenant session helpers.
  validators/           Zod schemas shared between client (React Hook Form + Zod resolver)
                        and server (Server Action validation). Consent-required on
                        personal-data forms per CI guard G5.
  email/                React Email templates (.tsx) + nodemailer SMTP send abstraction +
                        per-tenant credential resolver (AES-256-GCM encrypted at rest).
  storage/              StorageBackend interface (local-filesystem default;
                        S3/MinIO/R2 implementations available for later swap).
                        Signed-URL route handler.
  observability/        pino logger config + ErrorReporter interface
                        (no-op default; Sentry/GlitchTip swappable).
  entitlement/          isPackEnabled() helper + requirePack() Server Action wrapper +
                        <RequirePack> React Server Component (CI guard G12).
  utils/                Cross-cutting runtime helpers: audit(), notify(), recordConsent().
infrastructure/         Terraform (Cloudflare DNS + CDN), Docker Compose (Hetzner
                        services: app, workers, postgres, redis), Coolify manifests.
docs/
  adr/                  Architectural decision records.
  architecture/         Cross-cutting architecture notes (this file).
  runbooks/             Provisioning, restore, suspend, rotate-secrets, incident response.
  ci-guards/            One explainer per CI guard (what it catches, how to satisfy it).
audit/                  master-prompt-log.md + audit-report.md (build progress + drift).
design/canvas/          Visual source of truth (ported verbatim; not reformatted).
```

## Conformance with `AGENTS.md` §9

`AGENTS.md` §9 records the authoritative workspace layout. This document expands on it with the per-package responsibilities. Any structural change requires an amendment PR against `AGENTS.md` §9 first.

