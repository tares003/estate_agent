import type { Block } from 'payload';

// CMS authoring schema for the `hero` section — mirrors heroBlockSchema in
// components/blocks/HeroBlock.tsx one-for-one (enforced by blocks.test.ts).
export const heroBlock: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    { name: 'eyebrow', type: 'text' },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'ctaLabel', type: 'text' },
    { name: 'ctaHref', type: 'text' },
  ],
};
