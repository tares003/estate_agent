import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `testimonials`). A heading + customer quotes
// (design-canvas customer-story pull-quotes). Semantic <blockquote> + <cite>.
// Token-driven (G7).

export const testimonialsBlockSchema = z.object({
  heading: z.string().optional(),
  testimonials: z
    .array(z.object({ quote: z.string(), author: z.string(), role: z.string().optional() }))
    .min(1),
});

export type TestimonialsBlockData = z.infer<typeof testimonialsBlockSchema>;

export function TestimonialsBlock({ data }: { data: TestimonialsBlockData }) {
  return (
    <section className="container py-16">
      {data.heading ? <h2 className="t-heading-lg mb-8">{data.heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {data.testimonials.map((testimonial) => (
          <li key={testimonial.author}>
            <blockquote className="flex flex-col gap-4">
              <p className="t-body-lg">“{testimonial.quote}”</p>
              <cite className="t-heading-sm flex flex-col gap-1 not-italic">
                <span>{testimonial.author}</span>
                {testimonial.role ? (
                  <span className="t-caption text-text-secondary">{testimonial.role}</span>
                ) : null}
              </cite>
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
