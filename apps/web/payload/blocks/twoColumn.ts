import type { Block } from 'payload';

// CMS authoring schema for `two_column` — mirrors twoColumnBlockSchema in
// components/blocks/TwoColumnBlock.tsx (enforced by blocks.test.ts). Exactly two
// columns (minRows = maxRows = 2).
export const twoColumnBlock: Block = {
  slug: 'two_column',
  interfaceName: 'TwoColumnBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns',
      type: 'array',
      required: true,
      minRows: 2,
      maxRows: 2,
      fields: [
        { name: 'title', type: 'text' },
        { name: 'body', type: 'textarea', required: true },
      ],
    },
  ],
};
