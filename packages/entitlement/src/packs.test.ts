// pack: core — this is the entitlement catalogue's own test; it is core infrastructure.
import { describe, expect, it } from 'vitest';
import { ALL_PACK_SLUGS, OPTIONAL_PACK_SLUGS } from './packs.js';

describe('pack catalogue', () => {
  it('lists exactly the eleven optional (non-core) pack slugs', () => {
    expect(OPTIONAL_PACK_SLUGS).toEqual([
      'sales_plus',
      'new_homes',
      'commercial',
      'business_transfer',
      'care_homes',
      'portal_syndication',
      'calculators',
      'bulk_import',
      'feedback_reviews',
      'live_chat',
      'ai_assistant',
    ]);
  });

  it('does not include the implicit core slug in the optional list', () => {
    expect(OPTIONAL_PACK_SLUGS).not.toContain('core');
  });

  it('ALL_PACK_SLUGS is core followed by every optional slug', () => {
    expect(ALL_PACK_SLUGS).toEqual(['core', ...OPTIONAL_PACK_SLUGS]);
  });

  it('contains no duplicate slugs', () => {
    expect(new Set(ALL_PACK_SLUGS).size).toBe(ALL_PACK_SLUGS.length);
  });
});
