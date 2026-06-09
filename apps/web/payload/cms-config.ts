// The load-bearing constants of the Payload CMS mount (CLAUDE.md §9), extracted
// so they can be asserted in a unit test without importing the heavy Payload
// runtime (payload.config.ts → buildConfig + the db/editor packages).
//
// - CMS_ADMIN_ROUTE / CMS_API_ROUTE: the admin SPA and its API live entirely
//   under /admin/cms. The route-group folders in app/(payload)/ mirror these,
//   and the proxy (proxy.ts) exempts this prefix from SEO canonicalisation.
// - CMS_DB_SCHEMA: Payload manages its own tables via Drizzle in a dedicated
//   Postgres schema, isolated from Prisma's `public`-schema domain tables.

/** Where the CMS admin SPA is mounted. */
export const CMS_ADMIN_ROUTE = '/admin/cms';

/** Where the CMS REST/GraphQL API is mounted (nested under the admin route). */
export const CMS_API_ROUTE = '/admin/cms/api';

/** The dedicated Postgres schema that isolates Payload's tables from Prisma's. */
export const CMS_DB_SCHEMA = 'payload';
