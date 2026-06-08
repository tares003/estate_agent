# @estate/entitlement

Per-tenant **pack entitlement** — the mechanism that makes the platform a modular product (EPIC-AD; `PRODUCT.md` §5a).

## Public surface

- `isPackEnabled(tenantId, pack_slug): Promise<boolean>` — reads the tenant's `enabled_packs` JSONB via Prisma (cached per request).
- `requirePack(pack_slug)` — Server Action wrapper that throws if the pack is not enabled (caller handles the upsell).
- `<RequirePack pack="sales_plus">…</RequirePack>` — React Server Component that gates a route or section, rendering the `UpsellEmptyState` / 404 per the surface's pack-state spec.
- `usePackEntitlement()` — client hook exposing the current tenant's enabled packs (hydrated from the session).
- Payload CMS access-function helpers — pack-scoped content collections consult the same helper.

## Why it exists (guard G12)

Every code path that does **pack-dependent** work — Server Actions, route handlers, BullMQ workers, sidebar entries, page-builder block types, Payload collections — must consult this helper. Guard G12 (custom ESLint rule) rejects pack-dependent code that omits the check. Pack-off surfaces follow the §2a patterns: `PackLockPill`, `UpsellEmptyState`, or hard 404 (no admin-breach surface, e.g. EPIC-Y vendor portal).

## Discipline

Tests cover: pack-on render, pack-off render (correct §2a pattern), and a negative authorisation test per gated capability (`_tdd-protocol.md` §12). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B1 (EPIC-AD foundation).
