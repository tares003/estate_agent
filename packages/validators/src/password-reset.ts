/**
 * Password-reset forms (EPIC-N FR-N-5).
 *
 * Two schemas for the two-step reset flow:
 *
 *  - `passwordResetRequestSchema` backs `/forgot-password`: a visitor enters the
 *    email of an existing account to be emailed an opaque, single-use reset link.
 *    It captures personal data (the email), so it carries the mandatory
 *    `gdpr_consent` affirmation (CI guard G5; master spec §S.7) re-confirming the
 *    lawful basis for processing the address to deliver the link.
 *
 *  - `passwordResetSchema` backs `/reset-password`: the visitor sets a NEW
 *    password, carrying the opaque token from the email. It captures NO personal
 *    data — only a secret and an opaque token — so no consent affirmation applies
 *    (the token itself is the authorisation). The password meets the same
 *    minimum-length floor as registration; the auth layer hashes it (FR-N-1).
 */

import { z } from 'zod';
import { email, gdprConsent, nonEmptyString, password } from './fields.js';

export const passwordResetRequestSchema = z.object({
  email,
  gdpr_consent: gdprConsent,
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z.object({
  token: nonEmptyString,
  password,
});

export type PasswordReset = z.infer<typeof passwordResetSchema>;
