// EPIC-G contractor portal (FR-G-8, master spec §G.5) — the advance steps a
// contractor may take on their assigned ticket, WITHOUT signing in. A contractor
// can only move the ticket forward through its two work states; everything else
// (triage, hold, reject, complete-the-review) stays with staff. Pure + IO-free,
// so the allowed-step logic is unit-tested and the action/portal derive the
// target from the current status rather than trusting client input.

/** The single forward step a contractor may take from a given status, or null. */
const CONTRACTOR_STEPS: Record<string, { to: string; label: string }> = {
  contractor_assigned: { to: 'work_in_progress', label: 'Start work' },
  work_in_progress: { to: 'awaiting_review', label: 'Mark work complete' },
};

/** The contractor's next allowed advance from `status`, or null when there is none. */
export function contractorNextStep(status: string): { to: string; label: string } | null {
  return CONTRACTOR_STEPS[status] ?? null;
}
