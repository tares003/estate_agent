import type { RepairUrgency } from './repair-request.js';

// EPIC-G repair categories (master spec §G.3, FR-G-4) — the default catalogue.
// §G.3 lists 18 default categories; they seed a new tenant's repair_categories
// and are the fallback the public report-a-repair form shows before an admin
// customises the catalogue. Labels are the plain humanised slugs; default
// urgencies follow §G.3/§G.4 (most route to standard; emergency_repair is the
// one emergency default). Pure data — no IO.

/** One default repair category (a subset of the repair_categories columns). */
export interface DefaultRepairCategory {
  slug: string;
  label: string;
  defaultUrgency: RepairUrgency;
}

export const DEFAULT_REPAIR_CATEGORIES: readonly DefaultRepairCategory[] = [
  { slug: 'plumbing', label: 'Plumbing', defaultUrgency: 'standard' },
  { slug: 'heating', label: 'Heating', defaultUrgency: 'urgent' },
  { slug: 'electrical', label: 'Electrical', defaultUrgency: 'urgent' },
  { slug: 'appliance_issue', label: 'Appliance issue', defaultUrgency: 'standard' },
  { slug: 'damp_or_mould', label: 'Damp or mould', defaultUrgency: 'standard' },
  { slug: 'doors_or_locks', label: 'Doors or locks', defaultUrgency: 'urgent' },
  { slug: 'windows', label: 'Windows', defaultUrgency: 'standard' },
  { slug: 'roof_or_leak', label: 'Roof or leak', defaultUrgency: 'urgent' },
  { slug: 'pest_issue', label: 'Pest issue', defaultUrgency: 'standard' },
  { slug: 'garden_or_external', label: 'Garden or external', defaultUrgency: 'low' },
  { slug: 'general_maintenance', label: 'General maintenance', defaultUrgency: 'standard' },
  { slug: 'emergency_repair', label: 'Emergency repair', defaultUrgency: 'emergency' },
  { slug: 'flooring', label: 'Flooring', defaultUrgency: 'standard' },
  { slug: 'decoration', label: 'Decoration', defaultUrgency: 'low' },
  { slug: 'keys_lost', label: 'Lost keys', defaultUrgency: 'urgent' },
  { slug: 'communal_areas', label: 'Communal areas', defaultUrgency: 'standard' },
  { slug: 'internet_or_phone', label: 'Internet or phone', defaultUrgency: 'low' },
  { slug: 'other', label: 'Other', defaultUrgency: 'standard' },
];
