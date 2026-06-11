import { z } from 'zod';

// EPIC-G repair system (master spec §G.5, FR-G-6): the ticket status workflow.
// Statuses are the §G.6-specified enum verbatim (mirrored by the Prisma
// `repair_status` enum). The happy path is the §G.5 arrow chain; the off-path
// states are entered from any active state and resume back onto the path:
//   - awaiting_tenant — "admin asked for more info" (§G.2's "request more info"
//     action); resumes to the active path states once the tenant replies.
//   - on_hold — "e.g. waiting on parts"; resumes likewise.
//   - rejected — "not our responsibility"; terminal, and the admin MUST enter a
//     rejection reason (§G.5), enforced by the schema below.
//   - awaiting_review — the contractor hand-back (FR-G-8); review passes to
//     `completed` or fails back to `work_in_progress`.
// `completed` and `rejected` are terminal. Pure + IO-free.

/** The repair-ticket lifecycle statuses (mirrors the Prisma `repair_status` enum, §G.6). */
export const REPAIR_STATUSES = [
  'new',
  'triaged',
  'contractor_assigned',
  'work_in_progress',
  'awaiting_review',
  'completed',
  'awaiting_tenant',
  'on_hold',
  'rejected',
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

const OFF_PATH: readonly RepairStatus[] = ['awaiting_tenant', 'on_hold', 'rejected'];
const RESUME: readonly RepairStatus[] = ['triaged', 'contractor_assigned', 'work_in_progress'];

/** Allowed next statuses per status (master spec §G.5). Terminals map to []. */
export const REPAIR_STATUS_TRANSITIONS: Readonly<Record<RepairStatus, readonly RepairStatus[]>> = {
  new: ['triaged', ...OFF_PATH],
  triaged: ['contractor_assigned', ...OFF_PATH],
  contractor_assigned: ['work_in_progress', ...OFF_PATH],
  work_in_progress: ['awaiting_review', ...OFF_PATH],
  awaiting_review: ['completed', 'work_in_progress', 'rejected'],
  awaiting_tenant: [...RESUME, 'rejected'],
  on_hold: [...RESUME, 'rejected'],
  completed: [],
  rejected: [],
};

/** Whether `from → to` is an allowed transition (false for unknown/terminal/no-op). */
export function canRepairTransition(from: string, to: string): boolean {
  const allowed = (REPAIR_STATUS_TRANSITIONS as Record<string, readonly string[]>)[from];
  return allowed?.includes(to) ?? false;
}

/** Validates a status-update request; rejecting must carry the reason (§G.5). */
export const repairStatusUpdateSchema = z
  .object({
    repairId: z.string().uuid(),
    to: z.enum(REPAIR_STATUSES),
    notes: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.to === 'rejected' && value.notes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'A rejection reason is required when rejecting a repair.',
      });
    }
  });

export type RepairStatusUpdate = z.infer<typeof repairStatusUpdateSchema>;
