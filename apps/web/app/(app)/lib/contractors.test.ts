import { describe, expect, it, vi } from 'vitest';

import { listContractors } from './contractors.js';

describe('listContractors', () => {
  it('lists the tenant contractors in name order', async () => {
    const rows = [
      {
        id: 'k1',
        name: 'Ace Plumbing',
        email: 'ace@example.com',
        phone: null,
        trade: 'Plumbing',
        active: true,
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listContractors({ contractor: { findMany } });

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });
});
