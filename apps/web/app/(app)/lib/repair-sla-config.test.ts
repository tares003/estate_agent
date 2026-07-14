import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_REPAIR_SLA_CONFIG } from '@estate/validators';

import { loadRepairSlaConfig, type RepairSlaConfigReader } from './repair-sla-config.js';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// per-tenant SLA config read model. An unconfigured tenant must fall back to the
// master spec §G.4 targets + the FR-G-9 default thresholds, so behaviour is
// unchanged out of the box. Tenant isolation is applied by the caller (withTenant).

function reader(row: Record<string, number> | null): RepairSlaConfigReader {
  return {
    repairSlaConfig: {
      findFirst: vi.fn(async () => row as never),
    },
  };
}

describe('loadRepairSlaConfig', () => {
  it('falls back to the §G.4 / FR-G-9 defaults when the tenant has no config row', async () => {
    await expect(loadRepairSlaConfig(reader(null))).resolves.toEqual(DEFAULT_REPAIR_SLA_CONFIG);
  });

  it('returns the tenant-configured targets and thresholds when a row exists', async () => {
    const row = {
      emergencyTargetHours: 2,
      urgentTargetHours: 12,
      standardTargetHours: 72,
      lowTargetWorkingDays: 10,
      dueSoonThresholdPercent: 40,
      atRiskThresholdPercent: 80,
    };
    await expect(loadRepairSlaConfig(reader(row))).resolves.toEqual(row);
  });

  it('reads only the config columns (no over-fetch)', async () => {
    const db = reader(null);
    await loadRepairSlaConfig(db);
    expect(db.repairSlaConfig.findFirst).toHaveBeenCalledWith({
      select: {
        emergencyTargetHours: true,
        urgentTargetHours: true,
        standardTargetHours: true,
        lowTargetWorkingDays: true,
        dueSoonThresholdPercent: true,
        atRiskThresholdPercent: true,
      },
    });
  });
});
