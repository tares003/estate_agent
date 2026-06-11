import { describe, expect, it } from 'vitest';

import { variantKey } from './variant-key.js';

describe('variantKey', () => {
  it('inserts the variant name before the extension', () => {
    expect(variantKey('tenants/t/properties/p/abc.jpg', 'thumb')).toBe(
      'tenants/t/properties/p/abc.thumb.jpg',
    );
    expect(variantKey('tenants/t/properties/p/abc.webp', 'large')).toBe(
      'tenants/t/properties/p/abc.large.webp',
    );
  });
});
