# Workspace layout

The repository is a **two-stack monorepo**: a Python side (Django + Wagtail + Celery, managed by `uv`) and a TypeScript side (Next.js + shared packages, managed by `pnpm`). They share one PostgreSQL database and one design token source.

```
apps/
  next/                 Next.js (App Router, TS) — tenant admin, operator admin,
                        customer accounts + portals, CRM, repair flow, feedback,
                        property catalogue/detail. Consumes the Django JSON API.
services/
  django/               Django + Wagtail — public + platform marketing sites, CMS,
                        page builder, JSON API, auth foundation, models/migrations.
  workers/              Celery worker entrypoint (runs the services/django codebase).
packages/               TypeScript shared packages (pnpm workspace members):
  config/               Lint/format/type-check config + the 12 CI guards (G1–G12).
  tokens/               Design-token runtime accessor; one source → CSS vars + TS export.
  types/                Canonical entity types for every master-spec §J entity.
  validators/           Input-validation schemas. Zod (TS) + Pydantic (Py) generated
                        from one OpenAPI contract.
  i18n/                 Translation-key registry + t()/defineMessages() runtime.
  ui-components/        First-party React component library — EPIC-L primitives ported
                        from design/canvas/ (atoms, molecules, organisms, pack-state).
  entitlement/          Per-tenant pack entitlement — isPackEnabled / <RequirePack>.
  helpers/              Cross-cutting runtime helpers: audit(), notify(), recordConsent().
  api-client/           Next.js API client generated from the Django OpenAPI spec.
  email-templates/      Shared transactional email-template source.
infrastructure/         Terraform (Cloudflare), Docker Compose, deployment manifests.
docs/
  adr/                  Architectural decision records.
  architecture/         Cross-cutting architecture notes (this file).
  runbooks/             Provisioning, restore, suspend, rotate-secrets, incident response.
  ci-guards/            One explainer per CI guard (what it catches, how to satisfy it).
audit/                  master-prompt-log.md + audit-report.md (build progress + drift).
design/canvas/          Visual source of truth (ported verbatim; not reformatted).
```

## Deviation from `AGENTS.md` §9 concrete layout — recorded per the §9 clause

`AGENTS.md` §9 lists a **minimal** `packages/` set (`tokens`, `ui-components`, `validators`, `api-client`). The foundation work (`dev-briefs/sprint-01/_cross-cutting.md` §2 and the build prompt's STEP 2) additionally requires shared packages for **types, i18n, entitlement, config, helpers, and email-templates**. This layout is therefore a **superset** of §9 — not a contradiction. §9 explicitly allows this: *"If the stack chosen mandates a different layout, document the deviation in this file before starting."* This document is that record. (Tracked as audit-report row **D-006**.)

### Mapping foundation shared packages (`_cross-cutting.md` §2) → directories

| `_cross-cutting.md` §2 package | Directory |
|---|---|
| Validators | `packages/validators` |
| Types | `packages/types` |
| Tokens | `packages/tokens` |
| i18n | `packages/i18n` |
| UI primitives | `packages/ui-components` |
| Audit log helper | `packages/helpers` → `audit()` |
| Notification helper | `packages/helpers` → `notify()` |
| GDPR consent helper | `packages/helpers` → `recordConsent()` |

> Note: the audit / notify / consent helpers have a **Django (Python) counterpart** inside `services/django` as well — state changes originate server-side. The TS `packages/helpers` versions cover Next.js-side emission and the shared contract; both are tested to the 100% shared-package gate.

## Package-naming convention

TypeScript packages are scoped `@estate/<name>` (e.g. `@estate/tokens`, `@estate/config`). The Python project is `estate_platform` (see `services/django/pyproject.toml`).
