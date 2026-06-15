import { describe, expect, it } from 'vitest';

import { contractorNextStep } from './contractor-portal.js';

describe('contractorNextStep', () => {
  it('lets a contractor start work on an assigned ticket', () => {
    expect(contractorNextStep('contractor_assigned')).toEqual({
      to: 'work_in_progress',
      label: 'Start work',
    });
  });

  it('lets a contractor mark in-progress work complete (→ awaiting_review)', () => {
    expect(contractorNextStep('work_in_progress')).toEqual({
      to: 'awaiting_review',
      label: 'Mark work complete',
    });
  });

  it('offers no step once the work is submitted for review or beyond', () => {
    for (const status of ['awaiting_review', 'completed', 'rejected', 'new', 'triaged']) {
      expect(contractorNextStep(status)).toBeNull();
    }
  });
});
