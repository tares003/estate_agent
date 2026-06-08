# @estate/auth

Better Auth configuration and the platform's RBAC primitives.

## Better Auth setup

- **OAuth providers** — Microsoft (Office 365 / Microsoft 365), Google (Workspace / Gmail), Apple. Staff sign-in.
- **Magic-link** — vendor / landlord / tenant portals (EPIC-Y / Z / AA). Email delivered via `packages/email`.
- **WebAuthn** — staff 2FA (EPIC-N).
- **Multi-session** — staff who work across multiple tenants get a tenant picker post-sign-in.

## Session shape

The session cookie carries:
- `userId` — Better Auth user.
- `tenantId` — the tenant context (set when the user signs in on a tenant subdomain).
- `roleIds` — the user's roles in this tenant.
- `enabledPacks` — denormalised pack list for fast `<RequirePack>` checks.

## RBAC role library

- **Built-in roles** — Super Admin, Branch Manager, Property Lister, Lettings Negotiator, Sales Negotiator, Property Manager, Content Editor, Read-Only.
- **Permission matrix** — every capability (`property.create`, `property.publish`, `lead.assign_to_self`, `repair.close`, `cms.publish`, etc.) mapped to one or more roles.
- **Custom-role composition** — Super Admins can define new roles by composing permissions. "Test as role" simulator (EPIC-H FR-H-15).
- **Per-resource scoping** — properties are scoped to a branch; a Branch Manager only sees their branch's properties (enforced at the data layer via RLS + branch-scope guards).

## Discipline

Every role/permission gate ships with a negative test (`_tdd-protocol.md` §12): a user lacking the permission gets a 403 from the underlying capability, not just a hidden UI element. Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B0 (auth foundation).
