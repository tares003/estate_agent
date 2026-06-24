import { sdltConfigSchema } from '@estate/validators';

import { DEFAULT_SDLT_CONFIG, type SdltConfig } from './stamp-duty.js';

// EPIC-W FR-W-3 — the SDLT band-config read model. Returns the tenant's stored
// config when present and valid, else falls back to DEFAULT_SDLT_CONFIG so the
// public calculator works out of the box (and is resilient to a stored row that
// no longer parses). Tenant isolation is applied by the caller via withTenant
// (RLS); the structural reader keeps this DB-free for unit tests — a Prisma tx
// satisfies it.

/** Minimal read surface the loader needs (a Prisma tx satisfies it). */
export interface SdltConfigReader {
  sdltConfig: {
    findFirst(args?: { select?: { config: true } }): Promise<{ config: unknown } | null>;
  };
}

/**
 * Load the tenant's SDLT band config (FR-W-3), or DEFAULT_SDLT_CONFIG when none is
 * stored. A stored row that fails validation also falls back to the default rather
 * than feeding malformed bands into the engine. The caller scopes the read to the
 * tenant (withTenant / RLS).
 */
export async function loadSdltConfig(reader: SdltConfigReader): Promise<SdltConfig> {
  const row = await reader.sdltConfig.findFirst({ select: { config: true } });
  if (!row) return DEFAULT_SDLT_CONFIG;

  const parsed = sdltConfigSchema.safeParse(row.config);
  return parsed.success ? (parsed.data as SdltConfig) : DEFAULT_SDLT_CONFIG;
}
