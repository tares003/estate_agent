# @estate/api-client

Typed Next.js client for the Django JSON API, **generated from the Django OpenAPI spec** (ADR-0001 → Django Ninja emits the spec).

## Public surface

- A typed function per API capability (§K), with request/response types sourced from the OpenAPI schema (kept in lockstep with `@estate/types`).
- Session-cookie forwarding: the Django-issued session cookie is forwarded on every request so the server re-applies the tenant RLS GUC (`AGENTS.md` §9 multi-tenancy).
- The `entitlement` reader (`/api/tenant/me`) consumed by `@estate/entitlement`.

## Generation

`pnpm --filter @estate/api-client generate` regenerates from the committed OpenAPI artefact; CI fails if the generated client is stale relative to the spec.

## Discipline

Contract tests (schemathesis on the Django side) guarantee the spec is accurate; the generated client is type-checked against `@estate/types`.

Status: **skeleton** — built in Phase B2 (after ADR-0001 is `Accepted`).
