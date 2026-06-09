import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';

import { CMS_ADMIN_ROUTE, CMS_API_ROUTE, CMS_DB_SCHEMA } from './payload/cms-config.js';
import { CmsUsers } from './payload/collections/CmsUsers.js';
import { Media } from './payload/collections/Media.js';
import { Menus } from './payload/collections/Menus.js';
import { Pages } from './payload/collections/Pages.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Payload CMS 3.x mounted INSIDE the Next.js app (CLAUDE.md §9). The admin SPA
// is served at /admin/cms and its API under /admin/cms/api; the route-group
// folders under app/(payload)/ mirror these one-for-one. Payload manages its own
// tables via Drizzle, isolated under a dedicated `payload` Postgres schema so they
// never collide with Prisma's `public`-schema domain tables. RLS lives on the
// public tables; Payload's tables are tenant-scoped at the app layer via access
// functions (B23.3) because Payload queries do not flow through the Prisma
// tenant-RLS extension.
export default buildConfig({
  admin: {
    user: CmsUsers.slug,
    importMap: { baseDir: here },
  },
  routes: {
    admin: CMS_ADMIN_ROUTE,
    api: CMS_API_ROUTE,
  },
  collections: [Pages, Media, Menus, CmsUsers],
  editor: lexicalEditor(),
  secret: process.env['PAYLOAD_SECRET'] ?? '',
  db: postgresAdapter({
    schemaName: CMS_DB_SCHEMA,
    pool: { connectionString: process.env['DATABASE_URL'] ?? '' },
  }),
  // Self-hosted, privacy-first (CLAUDE.md §9): no phone-home.
  telemetry: false,
  typescript: {
    outputFile: path.resolve(here, 'payload-types.ts'),
  },
});
