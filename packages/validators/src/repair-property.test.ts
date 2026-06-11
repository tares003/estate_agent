import { describe, expect, it } from 'vitest';

import { repairPropertyLinkSchema } from './repair-property.js';

const repairId = '11111111-1111-1111-1111-111111111111';
const propertyId = '22222222-2222-2222-2222-222222222222';

describe('repairPropertyLinkSchema', () => {
  it('accepts a match and an unmatch (absent propertyId)', () => {
    expect(repairPropertyLinkSchema.safeParse({ repairId, propertyId }).success).toBe(true);
    expect(repairPropertyLinkSchema.safeParse({ repairId }).success).toBe(true);
  });

  it('rejects non-uuid ids', () => {
    expect(repairPropertyLinkSchema.safeParse({ repairId: 'nope', propertyId }).success).toBe(
      false,
    );
    expect(repairPropertyLinkSchema.safeParse({ repairId, propertyId: 'nope' }).success).toBe(
      false,
    );
  });
});
