// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SDLT_CONFIG, type SdltConfig } from './stamp-duty.js';
import { loadSdltConfig, type SdltConfigReader } from './sdlt-config.js';

// EPIC-W FR-W-3 — the SDLT band-config read model. Returns the tenant's stored
// config when present, else falls back to DEFAULT_SDLT_CONFIG so the public
// calculator works out of the box. Tenant isolation is the caller's (withTenant /
// RLS); the structural reader keeps this DB-free for unit tests — a Prisma tx
// satisfies it.

const STORED: SdltConfig = {
  standardBands: [
    { upTo: 200_000, ratePercent: 0 },
    { upTo: null, ratePercent: 6 },
  ],
  firstTimeBuyer: {
    maxPrice: 500_000,
    bands: [
      { upTo: 300_000, ratePercent: 0 },
      { upTo: null, ratePercent: 4 },
    ],
  },
  additionalPropertySurchargePercent: 4,
  lastUpdated: '2026-01-01',
};

function reader(row: { config: unknown } | null): {
  r: SdltConfigReader;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(row);
  return { r: { sdltConfig: { findFirst } } as unknown as SdltConfigReader, findFirst };
}

describe('loadSdltConfig', () => {
  it('falls back to DEFAULT_SDLT_CONFIG when no config is stored', async () => {
    const { r } = reader(null);
    expect(await loadSdltConfig(r)).toEqual(DEFAULT_SDLT_CONFIG);
  });

  it('returns the stored config when one exists', async () => {
    const { r } = reader({ config: STORED });
    expect(await loadSdltConfig(r)).toEqual(STORED);
  });

  it('falls back to the default when the stored config is malformed', async () => {
    const { r } = reader({ config: { standardBands: 'nonsense' } });
    expect(await loadSdltConfig(r)).toEqual(DEFAULT_SDLT_CONFIG);
  });

  it('reads at most one row (the single per-tenant config)', async () => {
    const { r, findFirst } = reader({ config: STORED });
    await loadSdltConfig(r);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
