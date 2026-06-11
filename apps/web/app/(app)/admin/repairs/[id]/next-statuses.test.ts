import { describe, expect, it } from 'vitest';

import { nextRepairStatusOptions } from './next-statuses.js';

describe('nextRepairStatusOptions', () => {
  it('labels the legal next statuses for an active ticket', () => {
    expect(nextRepairStatusOptions('new')).toEqual([
      { value: 'triaged', label: 'Triaged' },
      { value: 'awaiting_tenant', label: 'Awaiting tenant' },
      { value: 'on_hold', label: 'On hold' },
      { value: 'rejected', label: 'Rejected' },
    ]);
  });

  it('is empty for a terminal ticket and an unknown status', () => {
    expect(nextRepairStatusOptions('completed')).toEqual([]);
    expect(nextRepairStatusOptions('rejected')).toEqual([]);
    expect(nextRepairStatusOptions('mystery')).toEqual([]);
  });
});
