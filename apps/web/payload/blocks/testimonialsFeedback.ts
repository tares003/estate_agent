import type { Block } from 'payload';

// CMS authoring schema for `testimonials_feedback` (EPIC-AC FR-AC-5). Unlike the
// hardcoded `testimonials` block, this stores only DISPLAY config — the renderer
// (components/blocks/TestimonialsBlockDataDriven.tsx) fetches the tenant's
// published, publishable feedback and renders it as anonymised quotes. Field
// names mirror testimonialsDataDrivenBlockSchema (enforced by blocks.test.ts).
export const testimonialsFeedbackBlock: Block = {
  slug: 'testimonials_feedback',
  interfaceName: 'TestimonialsFeedbackBlock',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'limit',
      type: 'number',
      min: 1,
      max: 24,
      admin: { description: 'How many published testimonials to show (default 6).' },
    },
  ],
};
