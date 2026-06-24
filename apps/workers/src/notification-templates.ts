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

/** FR-G-8: the contractor's no-sign-in magic-link to an assigned ticket. */
const CONTRACTOR_ASSIGNED: EmailTemplateInput = {
  subject: 'You’ve been assigned a repair — {{reference}}',
  preheader: 'Open repair {{reference}} to view the details and mark it complete.',
  html:
    '<p>Hello {{contractorName}},</p>' +
    '<p>You’ve been assigned repair <strong>{{reference}}</strong>.</p>' +
    '<p>Open the ticket to view the details, add completion photos, and mark the work complete — no sign-in needed:</p>' +
    '<p><a href="{{link}}">View the repair</a></p>',
};

/** EPIC-N (FR-N-*): the passwordless sign-in link for the vendor/landlord/tenant
 *  portals. better-auth's magicLink plugin queues this via the auth sendMagicLink
 *  callback; `url` is the one-time verification link. */
const AUTH_MAGIC_LINK: EmailTemplateInput = {
  subject: 'Sign in to your account',
  preheader: 'Use this secure link to sign in — it expires shortly.',
  html:
    '<p>Hello,</p>' +
    '<p>Use this secure link to sign in. It expires shortly and can be used once:</p>' +
    '<p><a href="{{url}}">Sign in</a></p>' +
    '<p>If you didn’t request this, you can safely ignore this email.</p>',
};

/** EPIC-N (FR-N-5): the password-reset email. better-auth's emailAndPassword flow
 *  queues this via the auth sendResetPassword callback; `url` is the opaque,
 *  single-use reset link (the token expires 60 minutes after issue). */
const AUTH_PASSWORD_RESET: EmailTemplateInput = {
  subject: 'Reset your password',
  preheader: 'Use this secure link to choose a new password — it expires in 60 minutes.',
  html:
    '<p>Hello,</p>' +
    '<p>We received a request to reset your password. Use this secure link to choose a new ' +
    'one. It expires in 60 minutes and can be used once:</p>' +
    '<p><a href="{{url}}">Reset your password</a></p>' +
    '<p>If you didn’t request this, you can safely ignore this email — your password won’t change.</p>',
};

/** EPIC-AC (FR-AC-1/FR-AC-12): the post-journey feedback request — a no-sign-in
 *  link to the brief feedback form. Queued (e.g.) when a repair ticket transitions
 *  to `completed`; `url` is the one-time signed /feedback/<token> link. */
const FEEDBACK_REQUESTED: EmailTemplateInput = {
  subject: 'How did we do? Share your feedback',
  preheader: 'It takes less than a minute — no sign-in needed.',
  html:
    '<p>Hello,</p>' +
    '<p>Thank you — we’d love to hear how we did. It takes less than a minute, and there’s no sign-in:</p>' +
    '<p><a href="{{url}}">Leave your feedback</a></p>' +
    '<p>If now isn’t a good time, you can safely ignore this email.</p>',
};

const TEMPLATES: Record<string, EmailTemplateInput> = {
  'repair_request.received': REPAIR_RECEIVED,
  'repair.contractor_assigned': CONTRACTOR_ASSIGNED,
  'auth.magic_link': AUTH_MAGIC_LINK,
  'auth.password_reset': AUTH_PASSWORD_RESET,
  'feedback.requested': FEEDBACK_REQUESTED,
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
