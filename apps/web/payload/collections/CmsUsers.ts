import type { CollectionConfig } from 'payload';

// The CMS editor accounts that sign into /admin/cms. Named `cms_users` (not
// `users`) so it never collides with the Prisma-managed `users` table — and
// Payload's tables additionally live in their own `payload` Postgres schema
// (see payload.config.ts). Per-tenant scoping of who can see/manage whom lands
// with B23.3; for the mount this is authenticated-only.
export const CmsUsers: CollectionConfig = {
  slug: 'cms_users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'System',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  fields: [{ name: 'name', type: 'text' }],
};
