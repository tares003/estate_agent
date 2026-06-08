# apps/web

The single Next.js (App Router, TypeScript) application that serves every user-facing surface of the platform. **Payload CMS 3.x is mounted inside this app at `/admin/cms`** — there is no separate backend service.

## Surfaces served

- **Public marketing site** (EPIC-C) — tenant subdomain.
- **Platform marketing site** (EPIC-AE) — separate hostname, distinct theme preset.
- **Tenant admin** (EPIC-H) — `/admin` on the tenant subdomain.
- **Operator admin** (EPIC-AB) — separate subdomain (`admin.estateplatform.co.uk` or equivalent), distinct visual identity, bypasses tenant RLS.
- **Customer accounts** (EPIC-T).
- **Vendor / landlord / tenant portals** (EPIC-Y / Z / AA) — magic-link auth via Better Auth.
- **CRM** (EPIC-I), **repair flow** (EPIC-G), **feedback flow** (EPIC-AC).
- **Property catalogue + detail** (EPIC-F).
- **Payload CMS admin** at `/admin/cms` — content editors edit blocks for the marketing surfaces.

## Internal structure

```
apps/web/
  app/                  Next.js App Router routes
    (public)/           Public-site route group (no auth required)
    (tenant)/           Tenant-subdomain route group (Better Auth required)
    (operator)/         Operator-subdomain route group (operator scope)
    (portal)/           Vendor/landlord/tenant magic-link route group
    api/                Route handlers (signed-URL serving, webhooks, health)
  payload/              Payload CMS config (collections, blocks, access functions)
  middleware.ts         Tenant resolution, auth, RLS GUC setup
  components/           App-level components (route-specific)
                        Reusable primitives live in packages/ui
```

## Discipline

Every route ships with: a Playwright e2e for the user journey, a Vitest integration test for the Server Actions / handlers, a visual-regression screenshot at all 7 breakpoints (G11), an axe-core a11y pass (G9), a Lighthouse perf budget check (G3).

Status: **scaffold** — populated incrementally as epics ship.
