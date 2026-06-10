import { describe, expect, it } from 'vitest';

import { repairStatusDisplay, repairUrgencyDisplay } from './repair-display.js';

describe('repairUrgencyDisplay', () => {
  it('maps emergency to the danger tone and a readable label', () => {
    expect(repairUrgencyDisplay('emergency')).toEqual({ tone: 'danger', label: 'Emergency' });
  });

  it('maps the remaining urgencies to their semantic tones', () => {
    expect(repairUrgencyDisplay('urgent').tone).toBe('warning');
    expect(repairUrgencyDisplay('standard').tone).toBe('info');
    expect(repairUrgencyDisplay('low').tone).toBe('neutral');
  });

  it('falls back gracefully for an unknown urgency', () => {
    expect(repairUrgencyDisplay('whatever')).toEqual({ tone: 'neutral', label: 'whatever' });
  });
});

describe('repairStatusDisplay', () => {
  it('humanises multi-word statuses and tones the lifecycle', () => {
    expect(repairStatusDisplay('in_progress')).toEqual({ tone: 'warning', label: 'In progress' });
    expect(repairStatusDisplay('awaiting_parts').label).toBe('Awaiting parts');
    expect(repairStatusDisplay('completed').tone).toBe('success');
    expect(repairStatusDisplay('new').tone).toBe('info');
  });

  it('falls back gracefully for an unknown status', () => {
    expect(repairStatusDisplay('mystery')).toEqual({ tone: 'neutral', label: 'mystery' });
  });
});
