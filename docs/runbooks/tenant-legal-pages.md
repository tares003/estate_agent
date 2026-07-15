# Runbook — legal pages per tenant (Cookie Policy / Privacy / Terms / Complaints)

**Status:** operational requirement, not yet automated.
**Owner:** operator onboarding a tenant.
**Why this exists:** the public site links to legal pages that do not exist until someone authors them, and one of those links is GDPR-adjacent.

## The requirement

Master spec §120 (row 44) and §328 make four legal pages **CMS-managed rich-text pages**, rendered by the shared Payload catch-all at [`apps/web/app/(app)/[...slug]/page.tsx`](../../apps/web/app/(app)/[...slug]/page.tsx) — one template renders all four:

| Route | Slug | Linked from |
|---|---|---|
| `/cookies` | `cookies` | the global cookie-consent banner, [`apps/web/components/CookieBanner.tsx`](../../apps/web/components/CookieBanner.tsx) ("Cookie Policy") — **GDPR-adjacent** |
| `/privacy` | `privacy` | privacy references across forms + footer |
| `/terms` | `terms` | footer / sign-up |
| `/complaints` | `complaints` | footer |

A page only resolves once a **published** Payload `pages` document with the matching slug exists **for that tenant** (`getPublishedPage` in [`apps/web/app/(app)/lib/cms.ts`](../../apps/web/app/(app)/lib/cms.ts) filters by tenant + `_status: published`). Until then the route is a 404. The cookie-policy link is the most important of the four because the consent banner shows on every page and points at it.

## What an operator MUST do when provisioning a tenant

For each of the four slugs above, in the tenant's CMS admin (`/admin/cms`):

1. Create a page, set its **slug** to exactly `cookies` / `privacy` / `terms` / `complaints`.
2. Add the legal copy as rich text (a `richText` block).
3. **Publish** it (draft status will not render on the public site — FR-D-4).
4. Verify the public route resolves: visit `https://<tenant-host>/cookies` etc.

At minimum, publish **Cookie Policy** before the site goes live, so the consent banner's link is not a dead 404.

## The copy must be human-authored (CLAUDE.md §8)

These are legal documents. **Do not ship AI-generated legal text unreviewed.** The operator (or the tenant's own legal/compliance owner) supplies the copy. If a placeholder is published to unblock go-live, mark it unmistakably — e.g. a first line `DRAFT — replace with reviewed legal copy before go-live` — so it cannot be mistaken for a finalised policy.

## When tenant provisioning is automated

There is currently **no automated tenant-provisioning flow** in the codebase — tenants are created ad hoc (the dev seed at [`infrastructure/dev/setup-dev-db.mjs`](../../infrastructure/dev/setup-dev-db.mjs) inserts the dev tenant's Prisma rows only; it does not create CMS pages, and Payload is dormant in local dev). When a provisioning flow is built (operator admin / EPIC-AB), it should:

- Seed the four legal pages as **draft placeholders** (clearly marked as above), or
- Block the "go live" step until the operator confirms each has been authored and published.

Either way the placeholder/seed content is boilerplate scaffolding, **never** finalised legal text — the reviewed copy is always human-supplied. A seed helper is intentionally **not** committed today: with no provisioning flow to call it and Payload dormant in dev (so it cannot be exercised), it would be dead, untested code. Add it together with the flow that calls it.
