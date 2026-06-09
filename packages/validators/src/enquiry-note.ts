import { z } from 'zod';

// EPIC-I CRM (FR-I-5): the input for adding a threaded note to an enquiry. A note
// defaults to internal (staff-private) — it surfaces in client-facing comms only
// when explicitly made client-visible (`isInternal: false`).

const MAX_NOTE_LENGTH = 5000;

export const enquiryNoteCreateSchema = z.object({
  enquiryId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, 'A note cannot be empty.')
    .max(MAX_NOTE_LENGTH, `A note cannot exceed ${MAX_NOTE_LENGTH} characters.`),
  isInternal: z.boolean().default(true),
});

export type EnquiryNoteCreate = z.infer<typeof enquiryNoteCreateSchema>;
