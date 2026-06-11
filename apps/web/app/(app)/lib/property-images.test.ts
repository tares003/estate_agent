import { describe, expect, it, vi } from 'vitest';

import { listPropertyImages } from './property-images.js';

describe('listPropertyImages', () => {
  it('lists a listing gallery in sort order', async () => {
    const rows = [
      { id: 'i1', url: 'tenants/t/properties/p/a.jpg', alt: 'Front', sortOrder: 0, isPrimary: true },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listPropertyImages({ propertyImage: { findMany } }, 'p1');

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { propertyId: 'p1' },
      orderBy: { sortOrder: 'asc' },
    });
  });
});
