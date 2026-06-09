import { z } from 'zod';

// EPIC-D page-builder block (FR-D-2 `rich_text`). The CMS authors rich text in
// Lexical; Payload renders it to sanitised HTML stored as `html`, so the renderer
// just injects it. (Sanitisation is the CMS layer's responsibility, not here.)

export const richTextBlockSchema = z.object({
  html: z.string(),
  align: z.enum(['left', 'center']).optional(),
});

export type RichTextBlockData = z.infer<typeof richTextBlockSchema>;

export function RichTextBlock({ data }: { data: RichTextBlockData }) {
  const alignment = data.align === 'center' ? 'mx-auto text-center' : '';
  return (
    <section className="container py-12">
      <div
        className={`t-body-lg text-text-secondary max-w-[65ch] ${alignment}`.trim()}
        // CMS-authored, server-rendered rich text (sanitised upstream by the CMS).
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </section>
  );
}
