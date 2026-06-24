import { describe, expect, it } from 'vitest';

import { savedPropertyToggleSchema } from './saved-property.js';

// EPIC-T FR-T-5 — the save/unsave toggle input. The only field is the catalogue
// property's id; it MUST be a UUID (the action upserts/deletes a saved_properties
// row keyed on it). No personal data, so no GDPR-consent affirmation.

describe('savedPropertyToggleSchema', () => {
  it('accepts a well-formed property id', () => {
    const parsed = savedPropertyToggleSchema.safeParse({
      propertyId: '11111111-1111-1111-1111-111111111111',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a missing property id', () => {
    expect(savedPropertyToggleSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-UUID property id', () => {
    expect(savedPropertyToggleSchema.safeParse({ propertyId: 'nope' }).success).toBe(false);
  });
});
