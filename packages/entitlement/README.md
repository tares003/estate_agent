# @estate/entitlement

Per-tenant **pack entitlement** — the mechanism that makes the platform a modular product (EPIC-AD; `PRODUCT.md` §5a). Pairs with the Django-side helper (`services/django/.../entitlement/helpers.py`).

## Public surface (Next.js side)

- `isPackEnabled(tenant, pack_slug): boolean` — consults `/api/tenant/me` (`enabled_packs`).
- `<RequirePack pack="sales_plus">…</RequirePack>` — gates a route/section; renders the `UpsellEmptyState` / 404 per the surface's pack-state spec.
- `usePackEntitlement()` — hook exposing the current tenant's enabled packs.

Django side mirrors this with `isPackEnabled(...)` and the `@require_pack("…")` decorator for views/API routes.

## Why it exists (guard G12)

Every code path that does **pack-dependent** work — handlers, workers, API routes, sidebar entries, page-builder section types — must consult this helper. Guard G12 (custom ESLint + flake8 rule) rejects pack-dependent code that omits the check. Pack-off surfaces follow the §2a patterns: `PackLockPill`, `UpsellEmptyState`, or hard 404 (no admin-breach surface, e.g. EPIC-Y vendor portal).

## Discipline

Tests cover: pack-on render, pack-off render (correct §2a pattern), and a negative authorisation test per gated capability (`_tdd-protocol.md` §12). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B1 (EPIC-AD foundation).
