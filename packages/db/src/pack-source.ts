import type { PackSource } from '@estate/entitlement';

/** Minimal read surface PrismaPackSource needs (a PrismaClient satisfies it). */
export interface TenantPackReader {
  platformTenant: {
    findUnique(args: {
      where: { id: string };
      select: { enabledPacks: true };
    }): Promise<{ enabledPacks: unknown } | null>;
  };
}

/**
 * Prisma-backed {@link PackSource} for @estate/entitlement. Reads a tenant's
 * `enabled_packs` JSONB from `platform_tenants`. The `core` pack is implicit and
 * never stored, so it is not returned here — {@link isPackEnabled} treats it as
 * always-on. An unknown tenant yields no enabled packs.
 */
export class PrismaPackSource implements PackSource {
  constructor(private readonly db: TenantPackReader) {}

  async getEnabledPacks(tenantId: string): Promise<string[]> {
    const row = await this.db.platformTenant.findUnique({
      where: { id: tenantId },
      select: { enabledPacks: true },
    });
    if (!row) return [];
    const packs = row.enabledPacks;
    return Array.isArray(packs)
      ? packs.filter((pack): pack is string => typeof pack === 'string')
      : [];
  }
}
