/**
 * Repair-request form (PRODUCT.md §4 — "Report a repair" / repair_request).
 *
 * The tenant-facing maintenance report (EPIC-G FR-G-1). Captures personal data,
 * so it carries the `gdpr_consent` affirmation (G5).
 */

import { z } from 'zod';
import { email, nonEmptyString, ukPhone } from './fields.js';

/** Urgency taxonomy gating the SLA + emergency-dispatch channels (EPIC-G FR-G-5). */
export const repairUrgency = z.enum(['emergency', 'urgent', 'standard', 'low']);

export type RepairUrgency = z.infer<typeof repairUrgency>;

export const repairRequestSchema = z.object({
  name: nonEmptyString,
  email,
  phone: ukPhone,
  propertyReference: nonEmptyString,
  category: nonEmptyString,
  description: nonEmptyString,
  urgency: repairUrgency,
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: 'You must give consent to continue.' }),
  }),
});

export type RepairRequest = z.infer<typeof repairRequestSchema>;
