import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `three_pillar`). A heading + up to three
// feature pillars (design-canvas marketing-trust pillars grid). Token-driven (G7).
// Icons are deferred until an icon component exists (data carries title + body).

export const threePillarBlockSchema = z.object({
  heading: z.string().optional(),
  pillars: z
    .array(z.object({ title: z.string(), body: z.string() }))
    .min(1)
    .max(3),
});

export type ThreePillarBlockData = z.infer<typeof threePillarBlockSchema>;

export function ThreePillarBlock({ data }: { data: ThreePillarBlockData }) {
  return (
    <section className="container py-16">
      {data.heading ? <h2 className="t-heading-lg mb-8">{data.heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {data.pillars.map((pillar) => (
          <li key={pillar.title} className="flex flex-col gap-2">
            <h3 className="t-heading-sm">{pillar.title}</h3>
            <p className="t-body-md text-text-secondary">{pillar.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
