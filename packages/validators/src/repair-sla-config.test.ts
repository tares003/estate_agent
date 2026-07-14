import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REPAIR_SLA_CONFIG,
  repairSlaConfigSchema,
  type RepairSlaConfigInput,
} from './repair-sla-config.js';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// admin-editable per-urgency SLA targets + badge thresholds. The shipped defaults
// must reproduce master spec §G.4 exactly (emergency 4h, urgent 24h, standard 48h,
// non-urgent 5 working days) and the FR-G-9 default bands (green ≤ 50%, amber
// 50–75%, red > 75%), so an unconfigured tenant behaves exactly as before.

function config(over: Partial<RepairSlaConfigInput> = {}): RepairSlaConfigInput {
  return { ...DEFAULT_REPAIR_SLA_CONFIG, ...over };
}

describe('DEFAULT_REPAIR_SLA_CONFIG', () => {
  it('reproduces the master spec §G.4 targets and the FR-G-9 default thresholds', () => {
    expect(DEFAULT_REPAIR_SLA_CONFIG).toEqual({
      emergencyTargetHours: 4,
      urgentTargetHours: 24,
      standardTargetHours: 48,
      lowTargetWorkingDays: 5,
      dueSoonThresholdPercent: 50,
      atRiskThresholdPercent: 75,
    });
  });

  it('is itself valid against the schema', () => {
    expect(repairSlaConfigSchema.safeParse(DEFAULT_REPAIR_SLA_CONFIG).success).toBe(true);
  });
});

describe('repairSlaConfigSchema', () => {
  it('accepts a full custom configuration', () => {
    const parsed = repairSlaConfigSchema.safeParse(
      config({
        emergencyTargetHours: 2,
        urgentTargetHours: 12,
        standardTargetHours: 72,
        lowTargetWorkingDays: 10,
        dueSoonThresholdPercent: 40,
        atRiskThresholdPercent: 80,
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-positive or fractional target', () => {
    expect(repairSlaConfigSchema.safeParse(config({ emergencyTargetHours: 0 })).success).toBe(
      false,
    );
    expect(repairSlaConfigSchema.safeParse(config({ urgentTargetHours: -1 })).success).toBe(false);
    expect(repairSlaConfigSchema.safeParse(config({ standardTargetHours: 1.5 })).success).toBe(
      false,
    );
    expect(repairSlaConfigSchema.safeParse(config({ lowTargetWorkingDays: 0 })).success).toBe(
      false,
    );
  });

  it('rejects a target beyond the sane ceiling (a year of hours / working days)', () => {
    expect(repairSlaConfigSchema.safeParse(config({ standardTargetHours: 9000 })).success).toBe(
      false,
    );
    expect(repairSlaConfigSchema.safeParse(config({ lowTargetWorkingDays: 400 })).success).toBe(
      false,
    );
  });

  it('rejects a threshold outside 1–99 (breach is fixed at 100% per FR-G-9)', () => {
    expect(repairSlaConfigSchema.safeParse(config({ dueSoonThresholdPercent: 0 })).success).toBe(
      false,
    );
    expect(repairSlaConfigSchema.safeParse(config({ atRiskThresholdPercent: 100 })).success).toBe(
      false,
    );
    expect(repairSlaConfigSchema.safeParse(config({ atRiskThresholdPercent: 75.5 })).success).toBe(
      false,
    );
  });

  it('rejects an at-risk threshold at or below the due-soon threshold (bands must ascend)', () => {
    const parsed = repairSlaConfigSchema.safeParse(
      config({ dueSoonThresholdPercent: 80, atRiskThresholdPercent: 60 }),
    );
    expect(parsed.success).toBe(false);

    expect(
      repairSlaConfigSchema.safeParse(
        config({ dueSoonThresholdPercent: 70, atRiskThresholdPercent: 70 }),
      ).success,
    ).toBe(false);
  });
});
