/**
 * The exact GDPR-consent affirmation for the general-contact form. Captured
 * verbatim into the `consent_logs` row by the Server Action and rendered as the
 * checkbox label by the form, so the persisted text and the text the data
 * subject actually agreed to are guaranteed identical (master spec §S.7).
 *
 * Plain module (no 'use server') so it is safe to import into both the client
 * component (the form) and the server action.
 */
export const CONTACT_CONSENT_TEXT =
  'I agree that the agent may use my contact details to respond to my message, ' +
  'in line with their privacy policy.';
