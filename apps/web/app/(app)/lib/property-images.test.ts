import { describe, expect, it, vi } from 'vitest';

import { listHeroImages, listPropertyImages } from './property-images.js';

describe('listPropertyImages', () => {
  it('lists a listing gallery in sort order', async () => {
    const rows = [
      {
        id: 'i1',
        url: 'tenants/t/properties/p/a.jpg',
        alt: 'Front',
        sortOrder: 0,
        isPrimary: true,
      },
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

describe('listHeroImages', () => {
  it('reads the hero image per listing for a set of listings', async () => {
    const rows = [{ propertyId: 'p1', url: 'tenants/t/properties/p1/a.jpg', alt: 'Front' }];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listHeroImages({ propertyImage: { findMany } }, ['p1', 'p2']);

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { propertyId: { in: ['p1', 'p2'] }, isPrimary: true },
    });
  });

  it('skips the query entirely for an empty page', async () => {
    const findMany = vi.fn();
    const out = await listHeroImages({ propertyImage: { findMany } }, []);
    expect(out).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
