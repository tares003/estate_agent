/**
 * The exact GDPR-consent affirmation for the password-reset request form
 * (EPIC-N FR-N-5 — `/forgot-password`). Captured verbatim into the `consent_logs`
 * row by the Server Action and rendered as the checkbox label by the form, so the
 * persisted text and the text the data subject actually agreed to are guaranteed
 * identical (master spec §S.7).
 *
 * Plain module (no 'use server') so it is safe to import into both the client
 * component (the form) and the server action.
 */
export const FORGOT_PASSWORD_CONSENT_TEXT =
  'I agree to my email address being processed to send me a password-reset link, ' +
  'in line with the agent’s privacy policy.';
