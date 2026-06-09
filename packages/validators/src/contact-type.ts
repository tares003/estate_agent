import { z } from 'zod';

// EPIC-I CRM (FR-I-6): converting an enquiry produces a contact record. A contact
// is one of four party types; the staff member chooses which at conversion (the UI
// may pre-suggest one, but the type is an explicit decision).

export const CONTACT_TYPES = ['buyer', 'tenant', 'vendor', 'landlord'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const enquiryConversionSchema = z.object({
  enquiryId: z.string().uuid(),
  contactType: z.enum(CONTACT_TYPES),
});

export type EnquiryConversion = z.infer<typeof enquiryConversionSchema>;
