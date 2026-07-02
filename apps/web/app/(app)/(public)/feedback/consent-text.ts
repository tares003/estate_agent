/**
 * The exact GDPR-consent affirmation for the public feedback form (EPIC-AC,
 * FR-AC-3). The respondent's free-text comment can carry personal data and the
 * submission may be published as a testimonial, so this is a personal-data form
 * that must capture explicit consent (G5 / master spec §S.7).
 *
 * Captured verbatim into the `consent_logs` row by the Server Action and rendered
 * as the checkbox label by the form, so the persisted text and the text the data
 * subject actually agreed to are guaranteed identical.
 *
 * Plain module (no 'use server') so it is safe to import into both the client
 * component (the form) and the server action.
 */
export const FEEDBACK_CONSENT_TEXT =
  'I agree that the agent may use my feedback — including publishing it as a ' +
  'testimonial where I have allowed it — in line with their privacy policy.';
