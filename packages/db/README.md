# @estate/db

The single database layer. **Prisma** schema, generated client, and raw SQL migrations.

## Contents

- `schema.prisma` — every entity in master spec §J (and the `platform.tenants.enabled_packs` JSONB field per EPIC-AD §J.1 amendment).
- `migrations/` — Prisma Migrate-generated.
- `migrations/raw/` — hand-written SQL migrations for things Prisma doesn't model directly:
  - PostGIS extension enable + spatial column types + spatial indexes.
  - Row-Level Security policies (`CREATE POLICY` per tenant-owned table).
  - Custom B-tree, GIN, and BRIN indexes for hot query paths.
  - Materialised views for report aggregation.
- `extensions/tenant-rls.ts` — Prisma Client extension that issues `SET LOCAL app.current_tenant_id = '<uuid>'` on every query, in the same transaction. RLS policies reference `current_setting('app.current_tenant_id')::uuid`.
- `extensions/audit-log.ts` — Prisma Client extension that emits the `audit()` row for every state-changing query (paired with the `audit()` helper in `packages/utils`).

## Multi-tenancy

Shared PostgreSQL + RLS. The tenant resolver lives in `apps/web/middleware.ts` (for HTTP requests) and `apps/workers` (for queue jobs). Both call into this package's extension to apply the GUC.

## Discipline

Schema changes ship with up + down migrations + a Vitest test that asserts the migration is idempotent under re-run. RLS policies ship with a negative test (a query for tenant A returns zero rows when the GUC is set to tenant B). Coverage gate: **100% line + branch** on the extension code paths.

Status: **skeleton** — built in Phase B0 (foundation migrations).
