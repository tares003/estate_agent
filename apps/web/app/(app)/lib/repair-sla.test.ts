import { describe, expect, it } from 'vitest';

import { addWorkingDays, slaDueAt, slaRisk } from './repair-sla.js';

// §G.4 default SLA targets: emergency 4h, urgent 24h, standard 48h (acknowledged),
// low 5 working days (acknowledged). FR-G-9 default thresholds: green ≤ 50%,
// amber 50–75%, red > 75%, breached at 100%.

const CREATED = new Date('2026-06-08T08:00:00.000Z'); // a Monday

function at(hoursAfter: number): number {
  return CREATED.getTime() + hoursAfter * 3_600_000;
}

describe('addWorkingDays', () => {
  it('skips weekends', () => {
    // Friday + 5 working days = the following Friday
    expect(addWorkingDays(new Date('2026-06-12T10:00:00.000Z'), 5)).toEqual(
      new Date('2026-06-19T10:00:00.000Z'),
    );
    // Saturday start: the 5 working days are Mon–Fri
    expect(addWorkingDays(new Date('2026-06-13T10:00:00.000Z'), 5)).toEqual(
      new Date('2026-06-19T10:00:00.000Z'),
    );
  });
});

describe('slaDueAt', () => {
  it('applies the §G.4 default target per urgency', () => {
    expect(slaDueAt(CREATED, 'emergency')).toEqual(new Date('2026-06-08T12:00:00.000Z'));
    expect(slaDueAt(CREATED, 'urgent')).toEqual(new Date('2026-06-09T08:00:00.000Z'));
    expect(slaDueAt(CREATED, 'standard')).toEqual(new Date('2026-06-10T08:00:00.000Z'));
    // low: 5 working days from Monday = the following Monday
    expect(slaDueAt(CREATED, 'low')).toEqual(new Date('2026-06-15T08:00:00.000Z'));
  });

  it('treats an unknown urgency like standard (defensive default)', () => {
    expect(slaDueAt(CREATED, 'whatever')).toEqual(new Date('2026-06-10T08:00:00.000Z'));
  });
});

describe('slaRisk', () => {
  const emergency = { urgency: 'emergency', status: 'new', createdAt: CREATED };

  it('bands an open ticket by elapsed share of its target (FR-G-9 defaults)', () => {
    expect(slaRisk(emergency, at(1))).toBe('on_track'); // 25%
    expect(slaRisk(emergency, at(2))).toBe('on_track'); // 50% — green ≤ 50%
    expect(slaRisk(emergency, at(2.5))).toBe('due_soon'); // 62.5%
    expect(slaRisk(emergency, at(3))).toBe('due_soon'); // 75% — amber 50–75%
    expect(slaRisk(emergency, at(3.5))).toBe('at_risk'); // 87.5% — red > 75%
    expect(slaRisk(emergency, at(4))).toBe('breached'); // 100%
    expect(slaRisk(emergency, at(40))).toBe('breached');
  });

  it('does not band a closed ticket', () => {
    expect(slaRisk({ ...emergency, status: 'completed' }, at(40))).toBeNull();
    expect(slaRisk({ ...emergency, status: 'rejected' }, at(40))).toBeNull();
  });
});
