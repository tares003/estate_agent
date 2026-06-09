import type { EmailTemplateInput, TemplateValues } from '@estate/email';

// FR-D-8 send-test core (pure). Maps a stored email_template document to the
// @estate/email render input — the Lexical `body` is serialised to HTML by the
// injected serializer (Payload's convertLexicalToHTML at the call site) — and
// derives bracketed sample values for the declared variables so a test send shows
// where each variable lands. Dependency-light so it is node-env unit-testable.

/** The email_template fields this maps (loosely typed — it is a Payload doc). */
export interface EmailTemplateDoc {
  subject?: unknown;
  preheader?: unknown;
  body?: unknown;
  variables?: unknown;
}

/** Map a template doc to the renderer input, serialising the Lexical body. */
export function buildTemplateInput(
  doc: EmailTemplateDoc,
  serializeRichText: (body: unknown) => string,
): EmailTemplateInput {
  const input: EmailTemplateInput = {
    subject: String(doc.subject ?? ''),
    html: doc.body == null ? '' : serializeRichText(doc.body),
  };
  if (typeof doc.preheader === 'string' && doc.preheader !== '') {
    input.preheader = doc.preheader;
  }
  return input;
}

/** Derive `{ name: "[name]" }` sample values from a template's declared variables. */
export function sampleValuesFor(variables: unknown): TemplateValues {
  const values: Record<string, string> = {};
  if (Array.isArray(variables)) {
    for (const entry of variables) {
      const name = (entry as { name?: unknown } | null)?.name;
      if (typeof name === 'string' && name !== '') {
        values[name] = `[${name}]`;
      }
    }
  }
  return values;
}
