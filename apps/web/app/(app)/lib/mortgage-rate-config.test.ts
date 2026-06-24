// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_MORTGAGE_RATE_CONFIG, type MortgageRateConfig } from './mortgage.js';
import { loadMortgageRateConfig, type MortgageRateConfigReader } from './mortgage-rate-config.js';

// EPIC-W FR-W-7 — the mortgage-default read model. Returns the tenant's stored
// config when present and valid, else falls back to DEFAULT_MORTGAGE_RATE_CONFIG so
// the public calculator works out of the box (and is resilient to a stored row that
// no longer parses). Tenant isolation is the caller's (withTenant / RLS); the
// structural reader keeps this DB-free for unit tests — a Prisma tx satisfies it.

const STORED: MortgageRateConfig = {
  defaultAnnualRatePercent: 5.25,
  defaultTermYears: 30,
  defaultDepositPercent: 15,
  lastReviewed: '2026-05-01',
};

function reader(row: { config: unknown } | null): {
  r: MortgageRateConfigReader;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(row);
  return {
    r: { mortgageRateConfig: { findFirst } } as unknown as MortgageRateConfigReader,
    findFirst,
  };
}

describe('loadMortgageRateConfig', () => {
  it('falls back to DEFAULT_MORTGAGE_RATE_CONFIG when no config is stored', async () => {
    const { r } = reader(null);
    expect(await loadMortgageRateConfig(r)).toEqual(DEFAULT_MORTGAGE_RATE_CONFIG);
  });

  it('returns the stored config when one exists', async () => {
    const { r } = reader({ config: STORED });
    expect(await loadMortgageRateConfig(r)).toEqual(STORED);
  });

  it('falls back to the default when the stored config is malformed', async () => {
    const { r } = reader({ config: { defaultAnnualRatePercent: 'nonsense' } });
    expect(await loadMortgageRateConfig(r)).toEqual(DEFAULT_MORTGAGE_RATE_CONFIG);
  });

  it('reads at most one row (the single per-tenant config)', async () => {
    const { r, findFirst } = reader({ config: STORED });
    await loadMortgageRateConfig(r);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
