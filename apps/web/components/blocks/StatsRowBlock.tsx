import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `stats_row`). A heading + a row of headline
// stats (design-canvas KPI row). Token-driven (G7).

export const statsRowBlockSchema = z.object({
  heading: z.string().optional(),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
});

export type StatsRowBlockData = z.infer<typeof statsRowBlockSchema>;

export function StatsRowBlock({ data }: { data: StatsRowBlockData }) {
  return (
    <section className="bg-surface-sunken py-16">
      <div className="container">
        {data.heading ? <h2 className="t-heading-lg mb-8">{data.heading}</h2> : null}
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {data.stats.map((stat) => (
            <li key={stat.label} className="flex flex-col gap-1">
              <span className="t-display-md text-brand-primary">{stat.value}</span>
              <span className="t-body-sm text-text-secondary">{stat.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
