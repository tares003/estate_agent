import { describe, expect, it } from 'vitest';

import { shouldRequestRepairFeedback } from './feedback-trigger.js';

// EPIC-AC FR-AC-1/12 — the post-repair feedback request fires ONLY when a repair
// transitions INTO `completed`. This pure predicate isolates that decision so the
// audited setRepairStatus action stays testable.

describe('shouldRequestRepairFeedback', () => {
  it('is true for a transition into completed', () => {
    expect(shouldRequestRepairFeedback('awaiting_review', 'completed')).toBe(true);
  });

  it('is false for every non-completed target', () => {
    expect(shouldRequestRepairFeedback('new', 'triaged')).toBe(false);
    expect(shouldRequestRepairFeedback('work_in_progress', 'awaiting_review')).toBe(false);
    expect(shouldRequestRepairFeedback('awaiting_review', 'rejected')).toBe(false);
    expect(shouldRequestRepairFeedback('triaged', 'on_hold')).toBe(false);
  });

  it('is false when the repair is already completed (no re-trigger)', () => {
    expect(shouldRequestRepairFeedback('completed', 'completed')).toBe(false);
  });
});
