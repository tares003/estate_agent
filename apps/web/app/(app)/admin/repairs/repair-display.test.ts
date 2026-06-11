import { describe, expect, it } from 'vitest';

import { repairStatusDisplay, repairUrgencyDisplay, slaRiskDisplay } from './repair-display.js';

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
  it('covers the §G.5 happy path with humanised labels', () => {
    expect(repairStatusDisplay('new')).toEqual({ tone: 'info', label: 'New' });
    expect(repairStatusDisplay('triaged').label).toBe('Triaged');
    expect(repairStatusDisplay('contractor_assigned').label).toBe('Contractor assigned');
    expect(repairStatusDisplay('work_in_progress')).toEqual({
      tone: 'warning',
      label: 'In progress',
    });
    expect(repairStatusDisplay('awaiting_review').label).toBe('Awaiting review');
    expect(repairStatusDisplay('completed').tone).toBe('success');
  });

  it('covers the off-path states', () => {
    expect(repairStatusDisplay('awaiting_tenant')).toEqual({
      tone: 'warning',
      label: 'Awaiting tenant',
    });
    expect(repairStatusDisplay('on_hold')).toEqual({ tone: 'neutral', label: 'On hold' });
    expect(repairStatusDisplay('rejected')).toEqual({ tone: 'danger', label: 'Rejected' });
  });

  it('falls back gracefully for an unknown status', () => {
    expect(repairStatusDisplay('mystery')).toEqual({ tone: 'neutral', label: 'mystery' });
  });
});

describe('slaRiskDisplay', () => {
  it('maps the FR-G-9 risk bands to label-led badges', () => {
    expect(slaRiskDisplay('on_track')).toEqual({ tone: 'success', label: 'On track' });
    expect(slaRiskDisplay('due_soon')).toEqual({ tone: 'warning', label: 'Due soon' });
    expect(slaRiskDisplay('at_risk')).toEqual({ tone: 'danger', label: 'At risk' });
    expect(slaRiskDisplay('breached')).toEqual({ tone: 'danger', label: 'Breached' });
  });
});
