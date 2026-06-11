import { z } from 'zod';

// EPIC-G repair triage (master spec §G.6) — matching a ticket to a catalogue
// property ("property_id … matched by admin"). An absent propertyId unmatches the
// ticket. Pure + IO-free; the action verifies tenant-scoped existence.

export const repairPropertyLinkSchema = z.object({
  repairId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
});

export type RepairPropertyLink = z.infer<typeof repairPropertyLinkSchema>;
