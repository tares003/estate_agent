import { describe, expect, it } from 'vitest';

import { ENQUIRY_STATUSES } from '@estate/validators';

import { ageBandDisplay, statusDisplay } from './status-display.js';

describe('statusDisplay', () => {
  it('maps every committed status to a tone + a human label', () => {
    for (const status of ENQUIRY_STATUSES) {
      const display = statusDisplay(status);
      expect(display.label.length).toBeGreaterThan(0);
      expect(['neutral', 'success', 'warning', 'danger', 'info']).toContain(display.tone);
    }
  });

  it('uses success for converted and danger for lost', () => {
    expect(statusDisplay('converted')).toEqual({ tone: 'success', label: 'Converted' });
    expect(statusDisplay('lost')).toEqual({ tone: 'danger', label: 'Lost' });
  });

  it('falls back gracefully for an unknown status', () => {
    expect(statusDisplay('something_else')).toEqual({ tone: 'neutral', label: 'something_else' });
  });
});

describe('ageBandDisplay', () => {
  it('maps the SLA-urgency bands to semantic tones', () => {
    expect(ageBandDisplay('green').tone).toBe('success');
    expect(ageBandDisplay('amber').tone).toBe('warning');
    expect(ageBandDisplay('red')).toEqual({ tone: 'danger', label: 'Overdue' });
  });
});
