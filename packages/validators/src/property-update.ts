import { z } from 'zod';

import { nonEmptyString, ukPostcode } from './fields.js';

// EPIC-H property management (FR-H-2) — the admin "core details" update. The price
// is captured in whole pounds (£) — the action converts to the pence the column
// stores. Optional fields left blank clear the column. Market status + publish have
// their own lifecycle controls and are not part of this schema.
//
// G5 false-positive: `displayAddress`/`postcode` here are the LISTING's public
// marketing address (business data a staff member edits in the admin), not a data
// subject's personal data captured from a public form — no consent affirmation
// applies.
// eslint-disable-next-line estate/gdpr-consent
export const propertyUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  displayAddress: nonEmptyString,
  postcode: ukPostcode,
  price: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  receptions: z.number().int().nonnegative().optional(),
  description: z.string().trim().max(5000).optional(),
});

export type PropertyUpdate = z.infer<typeof propertyUpdateSchema>;
