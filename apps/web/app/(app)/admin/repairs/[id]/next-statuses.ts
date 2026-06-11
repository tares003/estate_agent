import { REPAIR_STATUS_TRANSITIONS, type RepairStatus } from '@estate/validators';

import { repairStatusDisplay } from '../repair-display.js';

// EPIC-G repair detail (FR-G-6) — a pure helper for the status changer: the
// statuses a ticket may legally move to (the §G.5 allow-list from the domain),
// labelled for the UI. Unit-tested in isolation so the client control stays
// declarative. Mirrors the enquiry detail's next-statuses helper.

export interface RepairStatusOption {
  value: RepairStatus;
  label: string;
}

/** The statuses `current` may transition to, with display labels (empty when terminal). */
export function nextRepairStatusOptions(current: string): RepairStatusOption[] {
  const allowed =
    (REPAIR_STATUS_TRANSITIONS as Record<string, readonly RepairStatus[]>)[current] ?? [];
  return allowed.map((value) => ({ value, label: repairStatusDisplay(value).label }));
}
