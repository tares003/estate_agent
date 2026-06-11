import { describe, expect, it } from 'vitest';

import {
  REPAIR_STATUSES,
  REPAIR_STATUS_TRANSITIONS,
  canRepairTransition,
  repairStatusUpdateSchema,
} from './repair-status.js';

const id = '11111111-1111-1111-1111-111111111111';

describe('REPAIR_STATUSES', () => {
  it('mirrors the §G.6 status enum (happy path + off-path states)', () => {
    expect(REPAIR_STATUSES).toEqual([
      'new',
      'triaged',
      'contractor_assigned',
      'work_in_progress',
      'awaiting_review',
      'completed',
      'awaiting_tenant',
      'on_hold',
      'rejected',
    ]);
  });
});

describe('REPAIR_STATUS_TRANSITIONS (§G.5)', () => {
  it('follows the happy-path arrows', () => {
    expect(canRepairTransition('new', 'triaged')).toBe(true);
    expect(canRepairTransition('triaged', 'contractor_assigned')).toBe(true);
    expect(canRepairTransition('contractor_assigned', 'work_in_progress')).toBe(true);
    expect(canRepairTransition('work_in_progress', 'awaiting_review')).toBe(true);
    expect(canRepairTransition('awaiting_review', 'completed')).toBe(true);
  });

  it('does not skip ahead on the happy path', () => {
    expect(canRepairTransition('new', 'contractor_assigned')).toBe(false);
    expect(canRepairTransition('new', 'completed')).toBe(false);
    expect(canRepairTransition('triaged', 'awaiting_review')).toBe(false);
  });

  it('reaches the off-path states from active states and resumes from them', () => {
    // awaiting_tenant — "admin asked for more info" (G.2 sets it from the detail view)
    expect(canRepairTransition('new', 'awaiting_tenant')).toBe(true);
    expect(canRepairTransition('work_in_progress', 'awaiting_tenant')).toBe(true);
    expect(canRepairTransition('awaiting_tenant', 'triaged')).toBe(true);
    // on_hold — "e.g. waiting on parts"
    expect(canRepairTransition('contractor_assigned', 'on_hold')).toBe(true);
    expect(canRepairTransition('on_hold', 'work_in_progress')).toBe(true);
    // rejected — reachable from any non-terminal state
    expect(canRepairTransition('new', 'rejected')).toBe(true);
    expect(canRepairTransition('awaiting_review', 'rejected')).toBe(true);
    expect(canRepairTransition('awaiting_tenant', 'rejected')).toBe(true);
  });

  it('a failed review goes back to work_in_progress', () => {
    expect(canRepairTransition('awaiting_review', 'work_in_progress')).toBe(true);
  });

  it('completed and rejected are terminal; unknown and no-op moves are refused', () => {
    expect(REPAIR_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(REPAIR_STATUS_TRANSITIONS.rejected).toEqual([]);
    expect(canRepairTransition('completed', 'new')).toBe(false);
    expect(canRepairTransition('rejected', 'triaged')).toBe(false);
    expect(canRepairTransition('mystery', 'triaged')).toBe(false);
    expect(canRepairTransition('new', 'new')).toBe(false);
  });
});

describe('repairStatusUpdateSchema', () => {
  it('accepts a plain transition, with or without notes', () => {
    expect(repairStatusUpdateSchema.safeParse({ repairId: id, to: 'triaged' }).success).toBe(true);
    expect(
      repairStatusUpdateSchema.safeParse({ repairId: id, to: 'on_hold', notes: 'Parts on order' })
        .success,
    ).toBe(true);
  });

  it('requires notes when rejecting (the §G.5 rejection reason)', () => {
    const missing = repairStatusUpdateSchema.safeParse({ repairId: id, to: 'rejected' });
    expect(missing.success).toBe(false);
    expect(
      repairStatusUpdateSchema.safeParse({
        repairId: id,
        to: 'rejected',
        notes: 'Tenant-caused damage — not our responsibility.',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown status and a non-uuid id', () => {
    expect(repairStatusUpdateSchema.safeParse({ repairId: id, to: 'pending' }).success).toBe(false);
    expect(repairStatusUpdateSchema.safeParse({ repairId: 'nope', to: 'triaged' }).success).toBe(
      false,
    );
  });
});
