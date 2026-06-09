import type { Block } from 'payload';

// CMS authoring schema for `stats_row` — mirrors statsRowBlockSchema in
// components/blocks/StatsRowBlock.tsx (enforced by blocks.test.ts).
export const statsRowBlock: Block = {
  slug: 'stats_row',
  interfaceName: 'StatsRowBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'stats',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
      ],
    },
  ],
};
