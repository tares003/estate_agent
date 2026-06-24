/**
 * @estate/validators — shared field helpers.
 *
 * One source of truth for the primitive field validators reused across every
 * public-form schema. Keeping them here means a UK-phone or postcode rule is
 * defined once and shared by client (React Hook Form + zodResolver) and server
 * (Server Action validation), exactly as the package README describes.
 */

import { z } from 'zod';

/**
 * A required free-text field: trims surrounding whitespace, then requires at
 * least one remaining character. Whitespace-only input therefore fails.
 */
export const nonEmptyString = z.string().trim().min(1, 'This field is required.');

/**
 * An email address. Trimmed and lowercased so storage and de-duplication are
 * case-insensitive, then validated for a well-formed address.
 */
export const email = z.string().trim().toLowerCase().email('Enter a valid email address.');

/**
 * A UK telephone number. Accepts the common public-form shapes — a plain
 * `07911123456`, an international `+44 7911 123456`, or a spaced landline such
 * as `020 7946 0958`. Spaces, hyphens and brackets are tolerated as separators;
 * the underlying digit count (optionally with a single leading `+`) must land
 * in the 10–13 character range once separators are stripped.
 */
export const ukPhone = z
  .string()
  .trim()
  .refine((value) => {
    const compact = value.replace(/[\s()-]/g, '');
    return /^\+?\d{10,13}$/.test(compact);
  }, 'Enter a valid UK phone number.');

/**
 * The minimum customer password length. A floor, not a strength oracle — the
 * register form surfaces a strength indicator (design brief §Authentication
 * forms) and FR-N-1 hashes the value with a memory-hard algorithm; this rule
 * only rejects trivially short input. 12 characters aligns with the OWASP
 * passphrase-friendly minimum.
 */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * An account password. Not trimmed (leading/trailing spaces are legitimate in a
 * passphrase), required to meet {@link PASSWORD_MIN_LENGTH}. Hashing happens in
 * the auth layer (FR-N-1); this validates only the input shape.
 */
export const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`);

/** Matches a UK postcode (loose, case-insensitive) once internal spaces are removed. */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

/**
 * A UK postcode. Accepts input with or without the internal space and any
 * casing; normalises to the canonical upper-case, single-space form
 * (e.g. `sw1a1aa` -> `SW1A 1AA`).
 */
export const ukPostcode = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, '').toUpperCase())
  .refine((value) => UK_POSTCODE.test(value), 'Enter a valid UK postcode.')
  .transform((value) => `${value.slice(0, -3)} ${value.slice(-3)}`);

/**
 * The GDPR consent affirmation required on every personal-data form (CI guard
 * G5; master spec §S.7). Only the literal boolean `true` passes — an unticked,
 * missing or non-boolean value is rejected.
 */
export const gdprConsent = z.literal(true, {
  errorMap: () => ({ message: 'You must give consent to continue.' }),
});
