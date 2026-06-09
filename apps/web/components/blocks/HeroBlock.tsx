import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `hero`). The Zod schema is the section's
// stored data shape — the single source of truth the renderer consumes and the
// (later) Payload Block config will mirror. Renderer is token-driven (G7).
//
// The CTA is a styled anchor, not a <Button> wrapped in <a> (that nests two
// interactive controls — an a11y violation), pending a link-styled button in
// @estate/ui (D-020).

export const heroBlockSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
});

export type HeroBlockData = z.infer<typeof heroBlockSchema>;

export function HeroBlock({ data }: { data: HeroBlockData }) {
  return (
    <section className="container py-20">
      <div className="flex max-w-[60ch] flex-col gap-4">
        {data.eyebrow ? (
          <p className="t-caption text-brand-primary uppercase">{data.eyebrow}</p>
        ) : null}
        <h1 className="t-display-lg">{data.title}</h1>
        {data.description ? (
          <p className="t-body-lg text-text-secondary">{data.description}</p>
        ) : null}
        {data.ctaLabel && data.ctaHref ? (
          <p className="mt-2">
            <a
              href={data.ctaHref}
              className="t-body-md text-brand-primary inline-flex items-center gap-1"
            >
              {data.ctaLabel} <span aria-hidden="true">→</span>
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
