// EPIC-G repairs inbox (FR-G-9, master spec §G.4) — the SLA-breach-risk domain.
// Pure + IO-free ("now" is injected) so the banding is unit-tested in isolation.
//
// Targets are the §G.4 DEFAULTS (the admin-editable taxonomy + per-urgency SLA
// config is FR-G-5, a later slice): emergency 4h, urgent 24h, standard 48h
// (acknowledgement), low 5 working days (acknowledgement; the committed enum value
// for the spec's "non-urgent" row). Thresholds are the FR-G-9 defaults: green
// ≤ 50% of target elapsed, amber 50–75%, red > 75%, breached at 100%. Closed
// tickets (completed / rejected) carry no risk band. The clock runs from
// submission regardless of off-path states — §G doesn't define SLA pausing, so
// none is invented.

/** FR-G-9 risk band for an open ticket. */
export type SlaRisk = 'on_track' | 'due_soon' | 'at_risk' | 'breached';

const HOUR_MS = 3_600_000;

/** §G.4 default targets in hours, per urgency (low is working-days based). */
const TARGET_HOURS: Record<string, number> = {
  emergency: 4,
  urgent: 24,
  standard: 48,
};

const LOW_TARGET_WORKING_DAYS = 5;

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

/** The §G.4 default due-at for a ticket (unknown urgency falls back to standard). */
export function slaDueAt(createdAt: Date, urgency: string): Date {
  if (urgency === 'low') return addWorkingDays(createdAt, LOW_TARGET_WORKING_DAYS);
  const hours = TARGET_HOURS[urgency] ?? TARGET_HOURS['standard']!;
  return new Date(createdAt.getTime() + hours * HOUR_MS);
}

const CLOSED_STATUSES = new Set(['completed', 'rejected']);

/** Band an open ticket by its elapsed share of the SLA target; null when closed. */
export function slaRisk(
  ticket: { urgency: string; status: string; createdAt: Date },
  now: number,
): SlaRisk | null {
  if (CLOSED_STATUSES.has(ticket.status)) return null;
  const start = ticket.createdAt.getTime();
  const due = slaDueAt(ticket.createdAt, ticket.urgency).getTime();
  const share = (now - start) / (due - start);
  if (share >= 1) return 'breached';
  if (share > 0.75) return 'at_risk';
  if (share > 0.5) return 'due_soon';
  return 'on_track';
}
