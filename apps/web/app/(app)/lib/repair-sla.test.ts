import { describe, expect, it } from 'vitest';
import { DEFAULT_REPAIR_SLA_CONFIG, type RepairSlaConfigInput } from '@estate/validators';

import { addWorkingDays, slaDueAt, slaRisk } from './repair-sla.js';

// §G.4 default SLA targets: emergency 4h, urgent 24h, standard 48h (acknowledged),
// low 5 working days (acknowledged). FR-G-9 default thresholds: green ≤ 50%,
// amber 50–75%, red > 75%, breached at 100%.
//
// FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable): both the
// targets and the two thresholds are per-tenant configurable. Omitting the config
// must reproduce the §G.4 / FR-G-9 defaults exactly (unchanged out of the box);
// supplying one must move the due-at and the bands accordingly.

const CREATED = new Date('2026-06-08T08:00:00.000Z'); // a Monday

function at(hoursAfter: number): number {
  return CREATED.getTime() + hoursAfter * 3_600_000;
}

function config(over: Partial<RepairSlaConfigInput> = {}): RepairSlaConfigInput {
  return { ...DEFAULT_REPAIR_SLA_CONFIG, ...over };
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
  it('applies the §G.4 default target per urgency when no config is supplied', () => {
    expect(slaDueAt(CREATED, 'emergency')).toEqual(new Date('2026-06-08T12:00:00.000Z'));
    expect(slaDueAt(CREATED, 'urgent')).toEqual(new Date('2026-06-09T08:00:00.000Z'));
    expect(slaDueAt(CREATED, 'standard')).toEqual(new Date('2026-06-10T08:00:00.000Z'));
    // low: 5 working days from Monday = the following Monday
    expect(slaDueAt(CREATED, 'low')).toEqual(new Date('2026-06-15T08:00:00.000Z'));
  });

  it('treats an unknown urgency like standard (defensive default)', () => {
    expect(slaDueAt(CREATED, 'whatever')).toEqual(new Date('2026-06-10T08:00:00.000Z'));
  });

  it('applies the tenant-configured target per urgency (FR-G-5)', () => {
    const tenantConfig = config({
      emergencyTargetHours: 2,
      urgentTargetHours: 12,
      standardTargetHours: 72,
      lowTargetWorkingDays: 10,
    });
    expect(slaDueAt(CREATED, 'emergency', tenantConfig)).toEqual(
      new Date('2026-06-08T10:00:00.000Z'),
    );
    expect(slaDueAt(CREATED, 'urgent', tenantConfig)).toEqual(new Date('2026-06-08T20:00:00.000Z'));
    expect(slaDueAt(CREATED, 'standard', tenantConfig)).toEqual(
      new Date('2026-06-11T08:00:00.000Z'),
    );
    // low: 10 working days from Monday = a fortnight of weekdays later
    expect(slaDueAt(CREATED, 'low', tenantConfig)).toEqual(new Date('2026-06-22T08:00:00.000Z'));
  });

  it('falls back to the configured standard target for an unknown urgency', () => {
    expect(slaDueAt(CREATED, 'whatever', config({ standardTargetHours: 72 }))).toEqual(
      new Date('2026-06-11T08:00:00.000Z'),
    );
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

  it('resolves a share sitting EXACTLY on a threshold to the LOWER band', () => {
    // slaRisk bands on a strict `>`, so a ticket exactly at a threshold has not yet
    // crossed it: 50% is still green, 75% is still amber. Pinned here — with `now`
    // INJECTED, so it is exact — because a test that reads the real clock cannot
    // express a boundary at all (its share is always a hair over the nominal age, so
    // it silently lands in the band above). Any caller banding against the wall clock
    // must therefore stay mid-band.
    expect(slaRisk(emergency, at(2))).toBe('on_track'); // exactly 50% — the due-soon edge
    expect(slaRisk(emergency, at(3))).toBe('due_soon'); // exactly 75% — the at-risk edge
    expect(slaRisk(emergency, at(4))).toBe('breached'); // exactly 100% — breach IS inclusive
  });

  it('does not band a closed ticket', () => {
    expect(slaRisk({ ...emergency, status: 'completed' }, at(40))).toBeNull();
    expect(slaRisk({ ...emergency, status: 'rejected' }, at(40))).toBeNull();
  });

  it('bands against the tenant-configured thresholds (FR-G-9)', () => {
    // Thresholds moved to 25% / 50% of the 4h emergency target: 1h and 2h elapsed.
    const strict = config({ dueSoonThresholdPercent: 25, atRiskThresholdPercent: 50 });
    expect(slaRisk(emergency, at(0.5), strict)).toBe('on_track'); // 12.5%
    expect(slaRisk(emergency, at(1), strict)).toBe('on_track'); // 25% — green ≤ 25%
    expect(slaRisk(emergency, at(1.5), strict)).toBe('due_soon'); // 37.5%
    expect(slaRisk(emergency, at(2), strict)).toBe('due_soon'); // 50% — amber 25–50%
    expect(slaRisk(emergency, at(2.5), strict)).toBe('at_risk'); // 62.5% — red > 50%
    expect(slaRisk(emergency, at(4), strict)).toBe('breached'); // 100% — breach is fixed
  });

  it('bands against the tenant-configured target (FR-G-5)', () => {
    // An 8h emergency target: 4h elapsed is only 50% — still on track, not breached.
    const relaxed = config({ emergencyTargetHours: 8 });
    expect(slaRisk(emergency, at(4), relaxed)).toBe('on_track');
    expect(slaRisk(emergency, at(7), relaxed)).toBe('at_risk'); // 87.5%
    expect(slaRisk(emergency, at(8), relaxed)).toBe('breached');
  });
});
