/**
 * Buyer-enquiry form (PRODUCT.md §4 — "Contact agent" / lead_type=buyer_enquiry).
 *
 * Canonical entity is the ENQUIRY (never "lead" in code — PRODUCT.md §2/§3).
 * Captures personal data, so it carries the `gdpr_consent` affirmation (G5).
 */

import { z } from 'zod';
import { email, nonEmptyString, ukPhone } from './fields.js';

export const buyerEnquirySchema = z.object({
  name: nonEmptyString,
  email,
  phone: ukPhone.optional(),
  message: nonEmptyString,
  propertyId: nonEmptyString.optional(),
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: 'You must give consent to continue.' }),
  }),
});

export type BuyerEnquiry = z.infer<typeof buyerEnquirySchema>;
