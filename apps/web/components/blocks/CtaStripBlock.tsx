import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `cta_strip`). A conversion strip — heading +
// optional supporting line + a call to action. The CTA is a styled anchor (not a
// <Button> nested in <a>, which would nest interactive controls), pending a
// link-styled button in @estate/ui (D-020).

export const ctaStripBlockSchema = z.object({
  heading: z.string(),
  description: z.string().optional(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
});

export type CtaStripBlockData = z.infer<typeof ctaStripBlockSchema>;

export function CtaStripBlock({ data }: { data: CtaStripBlockData }) {
  return (
    <section className="bg-surface-sunken py-16">
      <div className="container flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="t-heading-lg">{data.heading}</h2>
          {data.description ? (
            <p className="t-body-md text-text-secondary max-w-[55ch]">{data.description}</p>
          ) : null}
        </div>
        <a
          href={data.ctaHref}
          className="t-heading-sm text-brand-primary inline-flex shrink-0 items-center gap-1"
        >
          {data.ctaLabel} <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
