import type { CollectionConfig } from 'payload';

import { pageBlocks } from '../blocks/index.js';
import { tenantCreateAccess, tenantField, tenantScopedAccess } from '../access/tenant.js';

// EPIC-D managed pages: an ordered list of typed sections (the `sections` Blocks
// field, mirroring apps/web/components/blocks/*). Draft/publish via Payload
// versions (FR-D-4/5). Tenant-isolated at the app layer (B23.3) — every
// operation is scoped to the request's tenant; the page renderer (B23.4) consumes
// the current tenant's published pages.
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  versions: {
    drafts: true,
  },
  access: {
    read: tenantScopedAccess,
    create: tenantCreateAccess,
    update: tenantScopedAccess,
    delete: tenantScopedAccess,
  },
  fields: [
    tenantField,
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'URL path segment, e.g. "about" or "selling/guide".' },
    },
    {
      name: 'sections',
      type: 'blocks',
      blocks: pageBlocks,
      admin: {
        description:
          'Ordered page sections (FR-D-1/3) — add, remove and reorder without engineering.',
      },
    },
  ],
};
