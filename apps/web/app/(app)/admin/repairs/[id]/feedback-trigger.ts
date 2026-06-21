// EPIC-AC FR-AC-1/12 — the post-repair feedback request fires ONLY when a repair
// ticket transitions INTO `completed` (master spec §B.36 / Section J; the
// `repair_completed_satisfaction` hook). Isolating that decision as a pure,
// IO-free predicate keeps the audited setRepairStatus action testable and makes
// the "which transition triggers feedback?" rule a single reviewable line.

/**
 * Whether a `from → to` repair status change should trigger the post-repair
 * feedback request: only a transition INTO `completed` (and not a no-op from an
 * already-completed ticket).
 */
export function shouldRequestRepairFeedback(from: string, to: string): boolean {
  return to === 'completed' && from !== 'completed';
}
