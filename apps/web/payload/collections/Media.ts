import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CollectionConfig } from 'payload';

import { tenantCreateAccess, tenantField, tenantScopedAccess } from '../access/tenant.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// CMS-managed media. Uploads land on the local filesystem (apps/web/media) —
// the V1 object-storage decision in CLAUDE.md §9. Swapping to the
// packages/storage StorageBackend (signed-URL route) is a later refinement;
// Payload's local upload is itself the local-filesystem model. Tenant-isolated
// at the app layer (B23.3) like Pages.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
  },
  access: {
    read: tenantScopedAccess,
    create: tenantCreateAccess,
    update: tenantScopedAccess,
    delete: tenantScopedAccess,
  },
  upload: {
    staticDir: path.resolve(here, '../../media'),
  },
  fields: [tenantField, { name: 'alt', type: 'text' }],
};
