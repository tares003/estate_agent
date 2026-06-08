// pack: core
/**
 * The entitlement data source (EPIC-AD FR-AD-1 / FR-AD-3).
 *
 * Every pack-dependent code path resolves a tenant's enabled packs through a
 * `PackSource`, never by reading the entitlement field directly. The
 * Prisma-backed production implementation (reading `platform.tenants.enabled_packs`)
 * lands with `@estate/db`; until then, and for tests, an in-memory source factory
 * is provided here.
 */

import type { OptionalPackSlug } from './packs.js';

/** Resolves the optional packs a tenant has enabled. */
export interface PackSource {
  /** The optional-pack slugs enabled for `tenantId` (core is never listed). */
  getEnabledPacks(tenantId: string): Promise<string[]>;
}

/** Map of tenant id to that tenant's enabled optional-pack slugs. */
export type EnabledPacksByTenant = Readonly<Record<string, readonly OptionalPackSlug[]>>;

/**
 * Build an in-memory {@link PackSource} from a fixed tenant -> enabled-packs map.
 * Unknown tenants resolve to an empty list. Intended for tests and local
 * development; production resolves entitlement from the database.
 */
export function createInMemoryPackSource(byTenant: EnabledPacksByTenant = {}): PackSource {
  return {
    getEnabledPacks(tenantId: string): Promise<string[]> {
      return Promise.resolve([...(byTenant[tenantId] ?? [])]);
    },
  };
}
