import type { PageSection } from '../../../components/blocks/PageRenderer.js';

// Map Payload block instances to the PageRenderer section shape (EPIC-D B23.4).
// A Payload block is `{ blockType, ...fieldValues }` (+ Payload's own `id`/
// `blockName`); a PageRenderer section is `{ type, data }`. Direct blocks pass
// their field values straight through — the renderer's Zod schema strips the
// extra id/blockName on parse. rich_text is the one transform: its Lexical
// `content` is serialised to the `html` string the renderer expects, via an
// injected serializer (the real one is Payload's convertLexicalToHTML, wired in
// cms.ts) so this module stays pure and unit-testable.

/** A Payload Blocks-field instance. */
export interface PayloadBlock {
  blockType: string;
  [key: string]: unknown;
}

/** Serialise a Lexical editor state to sanitised HTML. */
export type RichTextSerializer = (content: unknown) => string;

/**
 * Drop keys whose value is null or undefined. Payload returns null for unset
 * optional fields, but the renderer's Zod `.optional()` accepts only
 * undefined/absent — so without this, any block with an empty optional fails
 * validation and is silently skipped. The mapper is the adapter, so it strips.
 */
function stripNullish<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

/** Map one Payload block instance to a renderer section. */
export function payloadBlockToSection(
  block: PayloadBlock,
  serializeRichText: RichTextSerializer,
): PageSection {
  const { blockType, ...fields } = block;

  if (blockType === 'rich_text') {
    const { content, align } = fields as { content?: unknown; align?: unknown };
    return {
      type: 'rich_text',
      data: stripNullish({ html: content == null ? '' : serializeRichText(content), align }),
    };
  }

  return { type: blockType, data: stripNullish(fields) };
}

/** Map a Payload page's ordered `sections` to renderer sections (order preserved). */
export function payloadPageToSections(
  sections: PayloadBlock[] | null | undefined,
  serializeRichText: RichTextSerializer,
): PageSection[] {
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections.map((block) => payloadBlockToSection(block, serializeRichText));
}
