import { describe, expect, it, vi } from 'vitest';

import { loadMortgageRatePresets, type MortgageRatePresetReader } from './mortgage-rate-presets.js';

// EPIC-W FR-W-8 — the mortgage rate preset read model. Returns the tenant's curated
// presets (ordered for the dropdown) as plain { id, label, annualRatePercent,
// termYears } records; an empty list when none are configured (the dropdown then
// simply offers nothing to apply). Tenant isolation is applied by the caller via
// withTenant (RLS); the structural reader keeps this DB-free for unit tests.

function reader(rows: unknown[]): {
  reader: MortgageRatePresetReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => rows);
  return {
    findMany,
    reader: { mortgageRatePreset: { findMany } } as unknown as MortgageRatePresetReader,
  };
}

describe('loadMortgageRatePresets', () => {
  it('returns the tenant presets as plain records', async () => {
    const { reader: r } = reader([
      { id: 'p1', label: '2-year fixed', annualRatePercent: 4.79, termYears: 25 },
      { id: 'p2', label: '5-year fixed', annualRatePercent: 4.49, termYears: 25 },
    ]);
    const presets = await loadMortgageRatePresets(r);
    expect(presets).toHaveLength(2);
    expect(presets[0]).toEqual({
      id: 'p1',
      label: '2-year fixed',
      annualRatePercent: 4.79,
      termYears: 25,
    });
  });

  it('orders by sortOrder then label', async () => {
    const { reader: r, findMany } = reader([]);
    await loadMortgageRatePresets(r);
    const arg = findMany.mock.calls[0]?.[0] as { orderBy?: unknown } | undefined;
    expect(arg?.orderBy).toEqual([{ sortOrder: 'asc' }, { label: 'asc' }]);
  });

  it('returns an empty list when none are configured', async () => {
    const { reader: r } = reader([]);
    expect(await loadMortgageRatePresets(r)).toEqual([]);
  });
});
