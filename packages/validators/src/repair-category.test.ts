import { describe, expect, it } from 'vitest';

import { DEFAULT_REPAIR_CATEGORIES } from './repair-category.js';
import { repairUrgency } from './repair-request.js';

describe('DEFAULT_REPAIR_CATEGORIES (§G.3 seed)', () => {
  it('carries the 18 §G.3 default categories in slug order', () => {
    expect(DEFAULT_REPAIR_CATEGORIES.map((c) => c.slug)).toEqual([
      'plumbing',
      'heating',
      'electrical',
      'appliance_issue',
      'damp_or_mould',
      'doors_or_locks',
      'windows',
      'roof_or_leak',
      'pest_issue',
      'garden_or_external',
      'general_maintenance',
      'emergency_repair',
      'flooring',
      'decoration',
      'keys_lost',
      'communal_areas',
      'internet_or_phone',
      'other',
    ]);
  });

  it('gives every category a human label and a valid default urgency', () => {
    for (const category of DEFAULT_REPAIR_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
      expect(repairUrgency.safeParse(category.defaultUrgency).success).toBe(true);
    }
  });

  it('maps the emergency_repair category to the emergency default urgency', () => {
    const emergency = DEFAULT_REPAIR_CATEGORIES.find((c) => c.slug === 'emergency_repair');
    expect(emergency?.defaultUrgency).toBe('emergency');
  });
});
