# ADR 0001 — API framework: Django Ninja vs Django REST Framework

- **Status:** Proposed (recommendation — awaiting ratification before Phase B2)
- **Date:** 2026-06-07
- **Deciders:** Platform engineering
- **Gates:** Phase B2 (the JSON API capability layer that the Next.js app consumes). Per `AGENTS.md` §9, no API-layer code is committed until this ADR is `Accepted`.

## Context

The recorded stack (`AGENTS.md` §9) is a two-stack architecture: Django + Wagtail serves content; Next.js serves the interactive app and consumes a **JSON API exposed by the Django side**. The §9 workspace layout further specifies:

- `packages/api-client` — "Next.js API client **generated from the Django OpenAPI spec**".
- `packages/validators` — "Zod on the Next.js side; Pydantic on the Django side; **both generated from one OpenAPI contract**".
- Testing stack — "Django API contract tests: **schemathesis** (against the Django Ninja / DRF schema)".

So the API layer must emit a **first-class, accurate OpenAPI 3 schema** that drives client codegen, cross-stack validator generation, and contract tests. That requirement is the dominant decision driver.

## Decision drivers

1. **OpenAPI fidelity** — the schema is the contract; it feeds api-client codegen + schemathesis + validator generation.
2. **Type-safety** — request/response models should be statically typed, mirrored cleanly into TypeScript.
3. **Boilerplate / velocity** — 30+ entities (§J) and a large capability set (§K) mean serializer overhead compounds.
4. **Async** — some endpoints (search, notifications) benefit from async handlers.
5. **Ecosystem maturity** — auth, permissions, throttling, pagination must be solved or trivially addable.
6. **RLS compatibility** — must compose with the per-request `SET LOCAL app.current_tenant_id` middleware (framework-agnostic, but simpler is better).

## Considered options

### Option A — Django Ninja (recommended)

- Pydantic-based schemas → typed in/out models, **native OpenAPI 3** with no extra layer.
- Generated OpenAPI maps cleanly to TypeScript (`openapi-typescript` / `orval`) for `packages/api-client`, and Pydantic schemas are reusable as the Django half of `packages/validators`.
- Async-capable handlers; FastAPI-like ergonomics; minimal boilerplate.
- Pairs directly with `schemathesis` (testing stack §9 names it).
- Smaller ecosystem than DRF; some advanced auth patterns are hand-rolled (acceptable — auth is Django/allauth/sesame, not DRF auth).

### Option B — Django REST Framework

- Most mature Django API ecosystem; batteries-included auth, throttling, pagination, browsable API.
- OpenAPI via `drf-spectacular` — good, but an **extra layer** between serializers and schema; serializer/schema drift is a known maintenance cost.
- Serializer boilerplate is heavier across 30+ entities; typing is weaker (serializers are runtime, not static types).
- Async support is partial.

## Decision (recommended)

**Adopt Django Ninja.** The decisive factor is the §9 layout's reliance on a high-fidelity OpenAPI contract for codegen, cross-stack validators, and schemathesis. Django Ninja produces that schema natively from the same Pydantic models used for validation, eliminating the serializer↔schema drift that drf-spectacular has to bridge, and gives stronger static typing for the TypeScript mirror. DRF's richer built-in auth is not needed because authentication is owned by Django auth + django-allauth + django-sesame, not the API framework.

## Consequences

- `packages/validators` Django half = the Pydantic schemas authored for Ninja; the OpenAPI export is the single contract; the Zod half and `packages/api-client` are **generated** from it (a CI step regenerates and diffs them).
- Pagination, throttling and consistent error envelopes are standardised in a thin first-party Ninja layer (documented in `services/django/CLAUDE.md` when B2 begins).
- Tenant RLS middleware runs ahead of Ninja routing — unaffected by this choice.
- If a future need (e.g. a public browsable API for partners) favours DRF for a bounded surface, DRF can be mounted alongside on a separate URL prefix without revisiting this ADR.

## Follow-ups before `Accepted`

- Ratify with the platform owner.
- Confirm the OpenAPI→TS toolchain (`openapi-typescript` vs `orval`) — recorded as a sub-note here, not a separate ADR.
