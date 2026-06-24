import { z } from 'zod';

// EPIC-T FR-T-5 — the save/unsave toggle input. The only field is the catalogue
// property's id, which the action upserts/deletes a saved_properties row against;
// it MUST be a UUID. The action gates on a signed-in, email-verified customer
// (FR-T-2) and runs tenant-scoped; this just validates the id shape. No personal
// data, so no GDPR-consent affirmation (the form is an authenticated toggle).

export const savedPropertyToggleSchema = z.object({
  propertyId: z.string().uuid(),
});

export type SavedPropertyToggle = z.infer<typeof savedPropertyToggleSchema>;
