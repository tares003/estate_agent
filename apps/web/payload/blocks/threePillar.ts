import type { Block } from 'payload';

// CMS authoring schema for `three_pillar` — mirrors threePillarBlockSchema in
// components/blocks/ThreePillarBlock.tsx (enforced by blocks.test.ts).
export const threePillarBlock: Block = {
  slug: 'three_pillar',
  interfaceName: 'ThreePillarBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'pillars',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 3,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'textarea', required: true },
      ],
    },
  ],
};
