# G12 — Pack-entitlement wrapper on pack-dependent code

**Catches:** a handler / route / worker / sidebar entry / page-builder section that does pack-dependent work without consulting the entitlement helper (`CLAUDE.md` RULE-ZERO #5 / EPIC-AD).

**Enforced by:** the ESLint rule `estate/pack-entitlement` (`packages/config/plugin/rules/g12-pack-entitlement.js`, messageId `missingPackGate`).

**Non-core pack slugs (`PRODUCT.md` §5a):** `sales_plus`, `new_homes`, `commercial`, `business_transfer`, `care_homes`, `portal_syndication`, `calculators`, `bulk_import`, `feedback_reviews`, `live_chat`, `ai_assistant`. (`core` is always on and never gated.)

**Trigger:** a file that references a non-core pack slug as a string literal but contains **no** gate — no `requirePack(...)` / `isPackEnabled(...)` call, no `<RequirePack>` element, and no `// pack: core` declaration.

**How to satisfy (any one):**

```ts
await requirePack('sales_plus');                  // Server Action / mutation — throws if off
if (await isPackEnabled(tenantId, 'sales_plus')) { … }
```

```tsx
<RequirePack pack="sales_plus">…</RequirePack> // route / section gating
```

```ts
// pack: core                                       // explicit always-on declaration
```

**Canonical violation → fix:** a `listVendorComparables` referencing `'sales_plus'` with no gate fails; wrapping it in `await requirePack('sales_plus')` (or `<RequirePack pack="sales_plus">`) passes. Core-pack surfaces need no gate.
