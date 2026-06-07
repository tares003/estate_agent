# services/django — the content + API stack

Django + Wagtail serving the **content-heavy surfaces** and the **JSON API** the Next.js app consumes. Managed by `uv` (not pnpm).

## Owns (per `AGENTS.md` §9)

- Public marketing site (EPIC-C) + platform marketing site (EPIC-AE) — Wagtail StreamField.
- CMS page builder (EPIC-D) — Wagtail admin.
- Auth foundation (EPIC-N) — Django auth + django-allauth; staff 2FA via django-otp + WebAuthn; portal magic-links via django-sesame.
- The data model (§J) — Django ORM models + migrations; **RLS policies in raw SQL migrations**.
- The JSON API (§K) — framework per **ADR-0001** (recommended: Django Ninja), emitting the OpenAPI contract.
- Pack entitlement evaluation (EPIC-AD) — `entitlement/helpers.py`, `@require_pack`.
- Per-tenant SMTP, mapping-key storage, Stripe billing, Turnstile verification.

## Multi-tenancy

Shared PostgreSQL + Row-Level Security. Per-request middleware resolves the tenant by hostname and sets `SET LOCAL app.current_tenant_id = '<uuid>'`; RLS policies reference `current_setting('app.current_tenant_id')::uuid`. Operator-admin uses a privileged role that bypasses tenant RLS (audited).

## Layout (filled in as epics land)

```
estate_platform/        Django project (settings, urls, asgi/wsgi)
apps/
  accounts/             auth, RBAC, users, roles (EPIC-N)
  tenancy/              tenant registry, RLS middleware, provisioning (EPIC-S)
  entitlement/          pack helpers + @require_pack (EPIC-AD)
  catalogue/            property model + PostGIS search (EPIC-F/§J.3)
  crm/ repairs/ content/ ...   one app per domain
  crypto/               EncryptedTextField/JSONField (ADR-0002)
  core/                 audit(), notify(), recordConsent() Python helpers
```

## Testing

pytest + pytest-django; hypothesis (property-based); schemathesis (API contract). Coverage via pytest-cov, combined with the Next.js coverage in CI.

Status: **skeleton** — `pyproject.toml` declares the dependency set; the Django project is initialised in Phase B2 (with the §J migrations).
