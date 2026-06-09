import type { Block } from 'payload';

// CMS authoring schema for the `faq` section — mirrors faqBlockSchema in
// components/blocks/FaqBlock.tsx one-for-one (enforced by blocks.test.ts). The
// renderer requires >=1 item, so the array is required with minRows 1.
export const faqBlock: Block = {
  slug: 'faq',
  interfaceName: 'FaqBlock',
  fields: [
    { name: 'title', type: 'text' },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'question', type: 'text', required: true },
        { name: 'answer', type: 'textarea', required: true },
      ],
    },
  ],
};
