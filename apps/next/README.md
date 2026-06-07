# apps/next — the application shell

Next.js (App Router, TypeScript) serving the **interactive surfaces** of the platform. Consumes the Django JSON API; never touches the database directly.

## Surfaces (per `AGENTS.md` §9 per-surface ownership)

Tenant admin (EPIC-H), operator admin (EPIC-AB, distinct visual identity), customer accounts (EPIC-T), vendor/landlord/tenant portals (EPIC-Y/Z/AA), CRM (EPIC-I), repair flow (EPIC-G), feedback flow (EPIC-AC), property catalogue + detail (EPIC-F).

## Foundations it sits on

`@estate/ui-components`, `@estate/tokens`, `@estate/types`, `@estate/validators`, `@estate/entitlement`, `@estate/helpers`, `@estate/i18n`, `@estate/api-client`.

## Non-negotiables (every route)

- Responsive at all 7 breakpoints (G11); WCAG 2.2 AA at every breakpoint (G9).
- Per-route JS/CSS bundle budget (`design-requirements.md` §3, guard G3).
- Pack-dependent routes gated via `<RequirePack>` (G12).
- Tenant context comes from the Django session cookie; forwarded on every API call.

Status: **skeleton** — first routes land in Sprint 02 (property catalogue) and the admin-shell phase.
