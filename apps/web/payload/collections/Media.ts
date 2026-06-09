import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CollectionConfig } from 'payload';

const here = path.dirname(fileURLToPath(import.meta.url));

// CMS-managed media. Uploads land on the local filesystem (apps/web/media) —
// the V1 object-storage decision in CLAUDE.md §9. Swapping to the
// packages/storage StorageBackend (signed-URL route) is a later refinement;
// Payload's local upload is itself the local-filesystem model.
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  upload: {
    staticDir: path.resolve(here, '../../media'),
  },
  fields: [{ name: 'alt', type: 'text' }],
};
