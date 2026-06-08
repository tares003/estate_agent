# G4 — Audit-log coverage on state changes

**Catches:** a state-changing handler that mutates data without emitting an audit-log row (`PRODUCT.md` §6 rule 3 / DoD item 6).

**Enforced by:** the ESLint rule `estate/audit-log-coverage` (`packages/config/plugin/rules/g04-audit-log-coverage.js`, messageId `missingAudit`).

**Trigger:** a function whose body begins with the `'use server'` directive **and** contains a Prisma mutation — `prisma.<model>.{create,update,delete,upsert,createMany,updateMany,deleteMany}` — must also call `audit(...)` in the same body, or carry an exemption comment.

**How to satisfy:** call the shared helper

```ts
await audit({ actor, action: "property.updated", entity: "property", entity_id: id, diff });
```

or, for a deliberate non-audited mutation, annotate it: `// audit-exempt: <reason>`.

**Canonical violation → fix:** a `'use server'` `updateProperty` doing `prisma.property.update(...)` with no `audit()` fails; adding the `audit({...})` call (or `// audit-exempt:`) passes. Read-only `findUnique`/`findMany` handlers are never flagged.
