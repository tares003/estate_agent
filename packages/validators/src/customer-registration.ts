/**
 * Customer-registration form (EPIC-T FR-T-1 — `/register`).
 *
 * A visitor registers a customer account with name, email, password, GDPR
 * consent and an OPTIONAL marketing opt-in. Captures personal data (name +
 * email), so it carries the mandatory `gdpr_consent` affirmation (CI guard G5;
 * master spec §S.7). The marketing opt-in is a SEPARATE, optional decision — it
 * defaults to `false` and must never gate registration. The password meets a
 * minimum-length floor here; the auth layer hashes it (FR-N-1).
 */

import { z } from 'zod';
import { email, nonEmptyString, password } from './fields.js';

export const customerRegistrationSchema = z.object({
  name: nonEmptyString,
  email,
  password,
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: 'You must give consent to continue.' }),
  }),
  marketingOptIn: z.boolean().default(false),
});

export type CustomerRegistration = z.infer<typeof customerRegistrationSchema>;
