import type { CollectionConfig } from 'payload';

// EPIC-D managed pages: an ordered list of typed sections (the Blocks field is
// added in B23.2, mirroring apps/web/components/blocks/*). Draft/publish via
// Payload versions (FR-D-4/5). Per-tenant + draft-visibility access scoping
// lands with B23.3; for the mount, published pages read publicly and the page
// renderer (B23.4) consumes them.
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
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'URL path segment, e.g. "about" or "selling/guide".' },
    },
  ],
};
