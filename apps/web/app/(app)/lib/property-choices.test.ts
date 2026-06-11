import { describe, expect, it, vi } from 'vitest';

import { listPropertyChoices } from './property-choices.js';

describe('listPropertyChoices', () => {
  it('lists live listings as id + address choices, address-ordered', async () => {
    const rows = [
      { id: 'p1', displayAddress: '1 Acacia Avenue' },
      { id: 'p2', displayAddress: '2 Birch Road' },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listPropertyChoices({ property: { findMany } });

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: { id: true, displayAddress: true },
      orderBy: { displayAddress: 'asc' },
    });
  });
});
