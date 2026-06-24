import { mortgageRateConfigSchema } from '@estate/validators';

import { DEFAULT_MORTGAGE_RATE_CONFIG, type MortgageRateConfig } from './mortgage.js';

// EPIC-W FR-W-7 — the mortgage-default read model. Returns the tenant's stored
// config when present and valid, else falls back to DEFAULT_MORTGAGE_RATE_CONFIG so
// the public calculator works out of the box (and is resilient to a stored row that
// no longer parses). Tenant isolation is applied by the caller via withTenant
// (RLS); the structural reader keeps this DB-free for unit tests — a Prisma tx
// satisfies it.

/** Minimal read surface the loader needs (a Prisma tx satisfies it). */
export interface MortgageRateConfigReader {
  mortgageRateConfig: {
    findFirst(args?: { select?: { config: true } }): Promise<{ config: unknown } | null>;
  };
}

/**
 * Load the tenant's mortgage-default config (FR-W-7), or DEFAULT_MORTGAGE_RATE_CONFIG
 * when none is stored. A stored row that fails validation also falls back to the
 * default rather than feeding malformed defaults into the calculator. The caller
 * scopes the read to the tenant (withTenant / RLS).
 */
export async function loadMortgageRateConfig(
  reader: MortgageRateConfigReader,
): Promise<MortgageRateConfig> {
  const row = await reader.mortgageRateConfig.findFirst({ select: { config: true } });
  if (!row) return DEFAULT_MORTGAGE_RATE_CONFIG;

  const parsed = mortgageRateConfigSchema.safeParse(row.config);
  return parsed.success ? (parsed.data as MortgageRateConfig) : DEFAULT_MORTGAGE_RATE_CONFIG;
}
