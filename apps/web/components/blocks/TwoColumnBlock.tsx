import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `two_column`). An optional heading + exactly
// two side-by-side text columns (design-canvas 2-col grid; stacks on mobile).
// Token-driven (G7).

export const twoColumnBlockSchema = z.object({
  heading: z.string().optional(),
  columns: z.array(z.object({ title: z.string().optional(), body: z.string() })).length(2),
});

export type TwoColumnBlockData = z.infer<typeof twoColumnBlockSchema>;

export function TwoColumnBlock({ data }: { data: TwoColumnBlockData }) {
  return (
    <section className="container py-16">
      {data.heading ? <h2 className="t-heading-lg mb-8">{data.heading}</h2> : null}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {data.columns.map((column, index) => (
          <div key={column.title ?? `column-${index}`} className="flex flex-col gap-2">
            {column.title ? <h3 className="t-heading-sm">{column.title}</h3> : null}
            <p className="t-body-md text-text-secondary">{column.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
