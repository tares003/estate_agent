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
  assigned: { tone: 'info', label: 'Assigned' },
  in_progress: { tone: 'warning', label: 'In progress' },
  awaiting_parts: { tone: 'warning', label: 'Awaiting parts' },
  completed: { tone: 'success', label: 'Completed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

/** The badge tone + label for a repair urgency (unknown values fall back gracefully). */
export function repairUrgencyDisplay(urgency: string): BadgeDisplay {
  return URGENCY_DISPLAY[urgency] ?? { tone: 'neutral', label: urgency };
}

/** The badge tone + label for a repair status (unknown values fall back gracefully). */
export function repairStatusDisplay(status: string): BadgeDisplay {
  return STATUS_DISPLAY[status] ?? { tone: 'neutral', label: status };
}
