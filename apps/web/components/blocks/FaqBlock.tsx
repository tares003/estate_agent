import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `faq`). Native <details>/<summary> accordion
// (the design-canvas pattern) — accessible and keyboard-operable without JS.

export const faqBlockSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
});

export type FaqBlockData = z.infer<typeof faqBlockSchema>;

export function FaqBlock({ data }: { data: FaqBlockData }) {
  return (
    <section className="container py-16">
      {data.title ? <h2 className="t-heading-lg mb-6">{data.title}</h2> : null}
      <div className="flex max-w-[70ch] flex-col gap-3">
        {data.items.map((item) => (
          <details key={item.question} className="border-divider border-b pb-3">
            <summary className="t-heading-sm cursor-pointer">{item.question}</summary>
            <p className="t-body-md text-text-secondary mt-2">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
