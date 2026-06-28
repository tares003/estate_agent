/**
 * Customer profile-update form (EPIC-T FR-T-11 — `/account/profile`).
 *
 * A registered, signed-in customer edits the contact + preference fields on
 * their OWN account: their display name, an optional phone, whether the agency
 * may contact them by email and/or SMS, and the marketing opt-in. Unlike
 * registration, this form CAPTURES no new personal data from a fresh lead — it
 * edits the record of an already-consented account holder — so it carries no
 * `gdpr_consent` affirmation (the marketing opt-in toggle is itself the consent
 * control for marketing). The G5 consent guard keys on the `name` / `phone`
 * field names and so false-positives on this self-service edit; the disable
 * below is scoped to this single schema with that justification, mirroring the
 * sign-in schema.
 *
 * `phone` is OPTIONAL: an empty submission clears it. Empty / whitespace-only
 * input coerces to `undefined` (cleared) rather than failing, so a customer who
 * never gave a phone can save the form without one; a non-empty value must be a
 * valid UK phone (`ukPhone`).
 */

import { z } from 'zod';
import { nonEmptyString, ukPhone } from './fields.js';

/**
 * The optional phone field. A blank / whitespace-only value means "no phone"
 * (coerced to `undefined`); any other value must pass the shared UK-phone rule.
 * Modelled as a pre-process so the form can always submit the field and an empty
 * box simply clears the stored number.
 */
const optionalPhone = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  ukPhone.optional(),
);

// eslint-disable-next-line estate/gdpr-consent -- self-service profile edit of an already-consented account holder; captures no new lead personal data, so no fresh consent applies (G5 false-positive on the name/phone fields). The marketing-opt-in toggle is the consent control.
export const customerProfileUpdateSchema = z.object({
  name: nonEmptyString,
  phone: optionalPhone,
  contactByEmail: z.boolean().default(false),
  contactBySms: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
});

export type CustomerProfileUpdate = z.infer<typeof customerProfileUpdateSchema>;
