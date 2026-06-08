/**
 * Valuation-request form (PRODUCT.md §4 — "Get a free valuation" / valuation_request).
 *
 * Captures personal data, so it carries the `gdpr_consent` affirmation (G5).
 */

import { z } from 'zod';
import { email, nonEmptyString, ukPhone, ukPostcode } from './fields.js';

export const valuationRequestSchema = z.object({
  name: nonEmptyString,
  email,
  phone: ukPhone,
  addressLine1: nonEmptyString,
  postcode: ukPostcode,
  propertyType: nonEmptyString,
  bedrooms: z.number().int().nonnegative().optional(),
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: 'You must give consent to continue.' }),
  }),
});

export type ValuationRequest = z.infer<typeof valuationRequestSchema>;
