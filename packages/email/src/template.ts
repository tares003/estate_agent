import type { Mailer } from './mailer.js';

// EPIC-D FR-D-8: CMS-managed email templates. A pure interpolation engine that
// turns a stored template (subject + optional preheader + body HTML, each with
// {{variable}} placeholders) and a set of variable values into a ready-to-send
// subject + HTML. Values that land in markup (body, preheader) are HTML-escaped
// to prevent injection/breakage; the subject is a plain-text header, left raw.
// Pure + dependency-free, so it is exhaustively unit-testable.

/** A stored template's renderable parts. */
export interface EmailTemplateInput {
  subject: string;
  preheader?: string;
  html: string;
}

/** A rendered email ready for the Mailer. */
export interface RenderedEmail {
  subject: string;
  html: string;
}

/** Variable values supplied at render time. */
export type TemplateValues = Record<string, string | number | boolean | null | undefined>;

/** `{{ name }}` / `{{name}}` placeholders (alphanumerics, underscore, dot). */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valueFor(values: TemplateValues, name: string): string {
  const value = values[name];
  return value === null || value === undefined ? '' : String(value);
}

function interpolate(template: string, values: TemplateValues, escape: boolean): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const raw = valueFor(values, name);
    return escape ? escapeHtml(raw) : raw;
  });
}

/** Hidden inbox-preview text injected at the top of the body. */
function preheaderHtml(text: string): string {
  return `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${text}</span>`;
}

/** Render a template with the given variable values. */
export function renderTemplate(
  template: EmailTemplateInput,
  values: TemplateValues,
): RenderedEmail {
  const subject = interpolate(template.subject, values, false);
  let html = interpolate(template.html, values, true);
  if (template.preheader !== undefined && template.preheader !== '') {
    html = preheaderHtml(interpolate(template.preheader, values, true)) + html;
  }
  return { subject, html };
}

/** Render a template and send it to `to` via the given Mailer (the send-test path). */
export async function sendTemplatedEmail(
  mailer: Mailer,
  template: EmailTemplateInput,
  values: TemplateValues,
  to: string,
): Promise<{ messageId: string }> {
  const rendered = renderTemplate(template, values);
  return mailer.send({ to, subject: rendered.subject, html: rendered.html });
}
