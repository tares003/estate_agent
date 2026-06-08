/**
 * Viewing-request form (PRODUCT.md §4 — "Book a viewing" / viewing_request).
 *
 * Captures personal data, so it carries the `gdpr_consent` affirmation (G5).
 */

import { z } from 'zod';
import { email, nonEmptyString, ukPhone } from './fields.js';

export const viewingRequestSchema = z.object({
  name: nonEmptyString,
  email,
  phone: ukPhone,
  propertyId: nonEmptyString,
  preferredDate: nonEmptyString,
  alternativeDate: nonEmptyString.optional(),
  message: nonEmptyString.optional(),
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: 'You must give consent to continue.' }),
  }),
});

export type ViewingRequest = z.infer<typeof viewingRequestSchema>;
