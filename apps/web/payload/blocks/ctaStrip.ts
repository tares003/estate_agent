import type { Block } from 'payload';

// CMS authoring schema for the `cta_strip` section — mirrors ctaStripBlockSchema
// in components/blocks/CtaStripBlock.tsx one-for-one (enforced by blocks.test.ts).
export const ctaStripBlock: Block = {
  slug: 'cta_strip',
  interfaceName: 'CtaStripBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'ctaLabel', type: 'text', required: true },
    { name: 'ctaHref', type: 'text', required: true },
  ],
};
