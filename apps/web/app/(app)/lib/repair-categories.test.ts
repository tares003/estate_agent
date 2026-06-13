import { describe, expect, it, vi } from 'vitest';

import { listVisibleRepairCategories, repairCategoryOptions } from './repair-categories.js';

describe('listVisibleRepairCategories', () => {
  it('lists the tenant visible categories in sort order', async () => {
    const rows = [{ slug: 'plumbing', label: 'Plumbing' }];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listVisibleRepairCategories({ repairCategory: { findMany } });

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { visible: true },
      orderBy: { sortOrder: 'asc' },
    });
  });
});

describe('repairCategoryOptions', () => {
  it('maps the tenant categories to value/label options', () => {
    expect(repairCategoryOptions([{ slug: 'heating', label: 'Heating' }])).toEqual([
      { value: 'heating', label: 'Heating' },
    ]);
  });

  it('falls back to the §G.3 defaults when the tenant has none configured', () => {
    const options = repairCategoryOptions([]);
    expect(options.length).toBe(18);
    expect(options[0]).toEqual({ value: 'plumbing', label: 'Plumbing' });
    expect(options.some((o) => o.value === 'emergency_repair')).toBe(true);
  });
});

import { listManagedRepairCategories } from './repair-categories.js';

describe('listManagedRepairCategories', () => {
  it('lists all categories (visible + hidden) in sort then label order', async () => {
    const rows = [
      {
        id: 'c1',
        slug: 'plumbing',
        label: 'Plumbing',
        defaultUrgency: 'standard',
        visible: true,
        sortOrder: 0,
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);

    const out = await listManagedRepairCategories({ repairCategory: { findMany } });

    expect(out).toBe(rows);
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
  });
});
