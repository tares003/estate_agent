import { ENQUIRY_STATUS_TRANSITIONS, LOST_REASONS, type EnquiryStatus } from '@estate/validators';

import { statusDisplay } from '../status-display.js';

// EPIC-H enquiry detail (FR-H-3) — pure helpers for the status changer: the
// statuses an enquiry may legally move to (the allow-list from the domain), and
// the lost-reason choices. Labelled for the UI; unit-tested in isolation so the
// client form stays declarative.

export interface StatusOption {
  value: EnquiryStatus;
  label: string;
}

/** The statuses `current` may transition to, with display labels (empty when terminal). */
export function nextStatusOptions(current: string): StatusOption[] {
  const allowed =
    (ENQUIRY_STATUS_TRANSITIONS as Record<string, readonly EnquiryStatus[]>)[current] ?? [];
  return allowed.map((value) => ({ value, label: statusDisplay(value).label }));
}

const LOST_REASON_LABELS: Record<(typeof LOST_REASONS)[number], string> = {
  price: 'Price',
  location: 'Location',
  fell_through: 'Fell through',
  no_response: 'No response',
  other: 'Other',
};

export interface LostReasonOption {
  value: (typeof LOST_REASONS)[number];
  label: string;
}

/** The lost-reason choices, labelled for the UI (required when moving to `lost`). */
export const LOST_REASON_OPTIONS: readonly LostReasonOption[] = LOST_REASONS.map((value) => ({
  value,
  label: LOST_REASON_LABELS[value],
}));
