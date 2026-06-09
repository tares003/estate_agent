import type { Block } from 'payload';

// CMS authoring schema for `testimonials` — mirrors testimonialsBlockSchema in
// components/blocks/TestimonialsBlock.tsx (enforced by blocks.test.ts).
export const testimonialsBlock: Block = {
  slug: 'testimonials',
  interfaceName: 'TestimonialsBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'testimonials',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'quote', type: 'textarea', required: true },
        { name: 'author', type: 'text', required: true },
        { name: 'role', type: 'text' },
      ],
    },
  ],
};
