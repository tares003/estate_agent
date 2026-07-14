import { DEFAULT_REPAIR_SLA_CONFIG, type RepairSlaConfigInput } from '@estate/validators';

// EPIC-G repairs inbox (FR-G-5 / FR-G-9, master spec §G.4) — the SLA-breach-risk
// domain. Pure + IO-free ("now" and the tenant's SLA config are both injected) so
// the banding is unit-tested in isolation.
//
// The targets and the two risk thresholds are PER-TENANT CONFIGURABLE (FR-G-5: §G.4
// marks each SLA target "(configurable)"; FR-G-9: the badge changes colour "at
// configurable thresholds"). The config is persisted per tenant in repair_sla_config
// and loaded by lib/repair-sla-config.ts; every function here takes it as an optional
// argument defaulting to DEFAULT_REPAIR_SLA_CONFIG, which reproduces the §G.4 targets
// (emergency 4h, urgent 24h, standard 48h acknowledgement, low 5 working days — the
// committed enum value for the spec's "non-urgent" row) and the FR-G-9 default bands
// (green ≤ 50%, amber 50–75%, red > 75%, breached at 100%). An unconfigured tenant is
// therefore banded exactly as it was before this slice landed.
//
// Breach is deliberately not configurable: FR-G-9 fixes it at 100% of the target
// elapsed. Closed tickets (completed / rejected) carry no risk band. The clock runs
// from submission regardless of off-path states — §G doesn't define SLA pausing, so
// none is invented.

/** FR-G-9 risk band for an open ticket. */
export type SlaRisk = 'on_track' | 'due_soon' | 'at_risk' | 'breached';

const HOUR_MS = 3_600_000;

/** The tenant's SLA settings — the §G.4 targets plus the FR-G-9 thresholds. */
export type SlaConfig = RepairSlaConfigInput;

/** The hours target for an urgency, falling back to `standard` for an unknown value. */
function targetHoursFor(urgency: string, config: SlaConfig): number {
  switch (urgency) {
    case 'emergency':
      return config.emergencyTargetHours;
    case 'urgent':
      return config.urgentTargetHours;
    default:
      return config.standardTargetHours;
  }
}

/** Add `days` working days (Mon–Fri) to a date, preserving the time of day. */
export function addWorkingDays(from: Date, days: number): Date {
  const out = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    const weekday = out.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return out;
}

/**
 * The due-at for a ticket under the tenant's SLA config (FR-G-5). An unknown urgency
 * falls back to the standard target; `low` is working-days based per §G.4. With no
 * config supplied the §G.4 defaults apply.
 */
export function slaDueAt(
  createdAt: Date,
  urgency: string,
  config: SlaConfig = DEFAULT_REPAIR_SLA_CONFIG,
): Date {
  if (urgency === 'low') return addWorkingDays(createdAt, config.lowTargetWorkingDays);
  return new Date(createdAt.getTime() + targetHoursFor(urgency, config) * HOUR_MS);
}

const CLOSED_STATUSES = new Set(['completed', 'rejected']);

/**
 * Band an open ticket by its elapsed share of the SLA target against the tenant's
 * configured thresholds (FR-G-9); null when closed. With no config supplied the
 * FR-G-9 defaults apply (green ≤ 50%, amber 50–75%, red > 75%, breached at 100%).
 */
export function slaRisk(
  ticket: { urgency: string; status: string; createdAt: Date },
  now: number,
  config: SlaConfig = DEFAULT_REPAIR_SLA_CONFIG,
): SlaRisk | null {
  if (CLOSED_STATUSES.has(ticket.status)) return null;
  const start = ticket.createdAt.getTime();
  const due = slaDueAt(ticket.createdAt, ticket.urgency, config).getTime();
  const share = (now - start) / (due - start);
  if (share >= 1) return 'breached';
  if (share > config.atRiskThresholdPercent / 100) return 'at_risk';
  if (share > config.dueSoonThresholdPercent / 100) return 'due_soon';
  return 'on_track';
}
