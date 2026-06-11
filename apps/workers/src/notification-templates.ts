import { renderTemplate, type EmailTemplateInput, type TemplateValues } from '@estate/email';

// EPIC-U email-send — the event→template registry. Each `subject.verb` event a
// notify() call can queue maps to a built-in default template, rendered with
// @estate/email's interpolation engine (markup values HTML-escaped). Events grow
// here with their owning epic; CMS-managed overrides (EPIC-D email_templates) are
// a later refinement. Unknown events render null — the dispatcher fails the row
// rather than guessing at content.
//
// NOTE (CLAUDE.md §8): the template copy below is AI-drafted and must be reviewed
// by a human before shipping to real recipients.

/** A rendered message body, ready for the Mailer envelope. */
export interface RenderedNotification {
  subject: string;
  html: string;
}

/** FR-G-3: the tenant confirmation for a received repair report (§G.1). */
const REPAIR_RECEIVED: EmailTemplateInput = {
  subject: 'We’ve received your repair report — {{reference}}',
  preheader: 'Your repair has been logged as {{reference}}.',
  html:
    '<p>Hello {{name}},</p>' +
    '<p>We’ve received your repair report and logged it as <strong>{{reference}}</strong>.</p>' +
    '<p>Category: {{category}}<br />Urgency: {{urgency}}</p>' +
    '<p>The repairs team will be in touch about the next steps.</p>',
};

const TEMPLATES: Record<string, EmailTemplateInput> = {
  'repair_request.received': REPAIR_RECEIVED,
};

/** Pull the string/number/boolean entries out of a queued row's JSON payload. */
function templateValues(payload: unknown): TemplateValues {
  const values: Record<string, string | number | boolean> = {};
  if (typeof payload === 'object' && payload !== null) {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        values[key] = value;
      }
    }
  }
  return values;
}

/** Render the message for a queued event, or null when no template exists. */
export function renderNotification(event: string, payload: unknown): RenderedNotification | null {
  const template = TEMPLATES[event];
  if (!template) return null;
  return renderTemplate(template, templateValues(payload));
}
