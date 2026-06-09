import type { BadgeTone } from '@estate/ui';
import { ENQUIRY_STATUSES, type EnquiryStatus } from '@estate/validators';

import type { AgeBand } from '../../lib/enquiries.js';

// EPIC-H enquiry queue (FR-H-3) — presentation mapping for the status + age-band
// badges. Pure (no React), so the label/tone choices are unit-tested and the table
// stays declarative. Enquiry status has no dedicated colour token (the
// --colour-status-* set is for property market_status), so statuses map to the
// semantic Badge tones; the age band maps to the SLA-urgency semantic tones.

interface BadgeDisplay {
  tone: BadgeTone;
  label: string;
}

const STATUS_DISPLAY: Record<EnquiryStatus, BadgeDisplay> = {
  new: { tone: 'info', label: 'New' },
  contacted: { tone: 'neutral', label: 'Contacted' },
  viewing_booked: { tone: 'info', label: 'Viewing booked' },
  valuation_booked: { tone: 'info', label: 'Valuation booked' },
  waiting: { tone: 'warning', label: 'Waiting' },
  converted: { tone: 'success', label: 'Converted' },
  lost: { tone: 'danger', label: 'Lost' },
  archived: { tone: 'neutral', label: 'Archived' },
};

const AGE_BAND_DISPLAY: Record<AgeBand, BadgeDisplay> = {
  green: { tone: 'success', label: 'On track' },
  amber: { tone: 'warning', label: 'Due soon' },
  red: { tone: 'danger', label: 'Overdue' },
};

function isEnquiryStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}

/** The badge tone + label for an enquiry status (unknown values fall back gracefully). */
export function statusDisplay(status: string): BadgeDisplay {
  return isEnquiryStatus(status) ? STATUS_DISPLAY[status] : { tone: 'neutral', label: status };
}

/** The badge tone + label for an enquiry's response-age band. */
export function ageBandDisplay(band: AgeBand): BadgeDisplay {
  return AGE_BAND_DISPLAY[band];
}
