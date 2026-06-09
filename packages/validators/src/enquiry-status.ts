import { z } from 'zod';

// EPIC-I CRM (master spec §I.3): the enquiry status workflow. Statuses use the
// committed Prisma `enquiry_status` enum values (schema is the source of truth —
// `waiting`, not the spec prose's `waiting_for_response`; G6). Transitions are an
// allow-list (illegal moves are rejected by the action); marking an enquiry
// `lost` requires a reason. Pure + IO-free.

/** The enquiry lifecycle statuses (mirrors the Prisma `enquiry_status` enum). */
export const ENQUIRY_STATUSES = [
  'new',
  'contacted',
  'viewing_booked',
  'valuation_booked',
  'waiting',
  'converted',
  'lost',
  'archived',
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/** The reasons an enquiry can be marked `lost` (recorded in the audit diff). */
export const LOST_REASONS = ['price', 'location', 'fell_through', 'no_response', 'other'] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** Allowed next statuses per status (master spec §I.3). `archived` is terminal. */
export const ENQUIRY_STATUS_TRANSITIONS: Readonly<Record<EnquiryStatus, readonly EnquiryStatus[]>> =
  {
    new: ['contacted', 'archived'],
    contacted: ['viewing_booked', 'valuation_booked', 'waiting', 'converted', 'lost', 'archived'],
    viewing_booked: ['waiting', 'converted', 'lost', 'archived'],
    valuation_booked: ['waiting', 'converted', 'lost', 'archived'],
    waiting: ['contacted', 'viewing_booked', 'valuation_booked', 'converted', 'lost', 'archived'],
    converted: ['archived'],
    lost: ['archived'],
    archived: [],
  };

/** Whether `from → to` is an allowed transition (false for unknown/terminal/no-op). */
export function canTransition(from: string, to: string): boolean {
  const allowed = (ENQUIRY_STATUS_TRANSITIONS as Record<string, readonly string[]>)[from];
  return allowed?.includes(to) ?? false;
}

/** Validates a status-update request; a `lost` transition must carry a reason. */
export const enquiryStatusUpdateSchema = z
  .object({
    enquiryId: z.string().uuid(),
    to: z.enum(ENQUIRY_STATUSES),
    reason: z.enum(LOST_REASONS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.to === 'lost' && value.reason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reason is required when marking an enquiry lost.',
      });
    }
  });
export type EnquiryStatusUpdate = z.infer<typeof enquiryStatusUpdateSchema>;
