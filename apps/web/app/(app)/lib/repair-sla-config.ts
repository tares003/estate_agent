import { DEFAULT_REPAIR_SLA_CONFIG, type RepairSlaConfigInput } from '@estate/validators';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// per-tenant repair SLA config read model. Returns the tenant's configured §G.4
// per-urgency targets + FR-G-9 badge thresholds, falling back to
// DEFAULT_REPAIR_SLA_CONFIG (the spec values) when the tenant has configured
// nothing — so slaDueAt / slaRisk behave identically out of the box. Tenant
// isolation is applied by the caller via withTenant (RLS); the structural reader
// keeps this DB-free for unit tests — a Prisma tx satisfies it.

/** The tenant's configured SLA targets + badge thresholds. */
export type RepairSlaSettings = RepairSlaConfigInput;

/** The persisted config columns (all non-null in the DB — each carries a default). */
type RepairSlaConfigRow = RepairSlaConfigInput;

/** Minimal read surface the loader needs (a Prisma tx satisfies it). */
export interface RepairSlaConfigReader {
  repairSlaConfig: {
    findFirst(args?: { select?: Record<string, unknown> }): Promise<RepairSlaConfigRow | null>;
  };
}

/** The columns the loader reads — no over-fetch. */
const SELECT = {
  emergencyTargetHours: true,
  urgentTargetHours: true,
  standardTargetHours: true,
  lowTargetWorkingDays: true,
  dueSoonThresholdPercent: true,
  atRiskThresholdPercent: true,
} as const;

/**
 * Load the tenant's repair SLA configuration (FR-G-5 / FR-G-9), falling back to the
 * master spec §G.4 targets + the FR-G-9 default thresholds when unconfigured. The
 * caller scopes the read to the tenant (withTenant / RLS).
 */
export async function loadRepairSlaConfig(
  reader: RepairSlaConfigReader,
): Promise<RepairSlaSettings> {
  const row = await reader.repairSlaConfig.findFirst({ select: SELECT });
  return row ?? DEFAULT_REPAIR_SLA_CONFIG;
}
