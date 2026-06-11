import type { BadgeTone } from '@estate/ui';

// EPIC-G repairs inbox (FR-G-2) — presentation mapping for the urgency + status
// badges. Pure (no React), so the label/tone choices are unit-tested and the table
// stays declarative. Repair urgency + status have no dedicated colour token (the
// --colour-status-* set is for property market_status), so they map to the semantic
// Badge tones (G7 — tone is a token, never raw colour). Unknown values fall back to
// the neutral tone with the raw value, so a future enum addition never crashes.

interface BadgeDisplay {
  tone: BadgeTone;
  label: string;
}

const URGENCY_DISPLAY: Record<string, BadgeDisplay> = {
  emergency: { tone: 'danger', label: 'Emergency' },
  urgent: { tone: 'warning', label: 'Urgent' },
  standard: { tone: 'info', label: 'Standard' },
  low: { tone: 'neutral', label: 'Low' },
};

const STATUS_DISPLAY: Record<string, BadgeDisplay> = {
  new: { tone: 'info', label: 'New' },
  triaged: { tone: 'neutral', label: 'Triaged' },
  contractor_assigned: { tone: 'info', label: 'Contractor assigned' },
  work_in_progress: { tone: 'warning', label: 'In progress' },
  awaiting_review: { tone: 'warning', label: 'Awaiting review' },
  completed: { tone: 'success', label: 'Completed' },
  awaiting_tenant: { tone: 'warning', label: 'Awaiting tenant' },
  on_hold: { tone: 'neutral', label: 'On hold' },
  rejected: { tone: 'danger', label: 'Rejected' },
};

/** The badge tone + label for a repair urgency (unknown values fall back gracefully). */
export function repairUrgencyDisplay(urgency: string): BadgeDisplay {
  return URGENCY_DISPLAY[urgency] ?? { tone: 'neutral', label: urgency };
}

/** The badge tone + label for a repair status (unknown values fall back gracefully). */
export function repairStatusDisplay(status: string): BadgeDisplay {
  return STATUS_DISPLAY[status] ?? { tone: 'neutral', label: status };
}

const SLA_RISK_DISPLAY: Record<string, BadgeDisplay> = {
  on_track: { tone: 'success', label: 'On track' },
  due_soon: { tone: 'warning', label: 'Due soon' },
  at_risk: { tone: 'danger', label: 'At risk' },
  breached: { tone: 'danger', label: 'Breached' },
};

/** The badge tone + label for an FR-G-9 SLA risk band (label-led, never colour alone — G9). */
export function slaRiskDisplay(risk: string): BadgeDisplay {
  return SLA_RISK_DISPLAY[risk] ?? { tone: 'neutral', label: risk };
}
