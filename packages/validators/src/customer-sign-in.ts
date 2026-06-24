/**
 * Customer sign-in form (EPIC-T FR-T-3 — `/sign-in`).
 *
 * A registered customer authenticates with email + password. Unlike
 * registration, this form CAPTURES no new personal data — it transmits an
 * existing credential to be checked against the stored hash — so it carries no
 * `gdpr_consent` affirmation. The G5 consent guard keys on the presence of an
 * `email` field name and so false-positives on the login credential here; the
 * disable below is scoped to this single schema with that justification.
 *
 * The email is normalised exactly as at registration (trim + lowercase) so the
 * lookup matches the stored, normalised address. The password is validated only
 * as a non-empty string: the minimum-length FLOOR is a registration-time rule
 * (`fields.password`), and re-asserting it at sign-in would both leak the policy
 * and refuse an account whose stored password predates the current rule. The
 * credential either matches the stored hash or it does not — that decision is the
 * auth layer's (FR-N-1), not this schema's.
 */

import { z } from 'zod';
import { email } from './fields.js';

// eslint-disable-next-line estate/gdpr-consent -- sign-in authenticates an existing account; it captures no new personal data, so no fresh consent applies (G5 false-positive on the email credential field).
export const customerSignInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export type CustomerSignIn = z.infer<typeof customerSignInSchema>;
