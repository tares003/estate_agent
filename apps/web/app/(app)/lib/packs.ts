import { isPackEnabled, type PackSlug } from '@estate/entitlement';
import { PrismaPackSource, type TenantPackReader } from '@estate/db';

import { getDb } from './db.js';
import { getCurrentTenantId } from './tenant.js';

// EPIC-AD entitlement resolution for the app (FR-AD-3 / G12). Resolves the current
// tenant's enabled optional-pack slugs from the operator-owned `platform_tenants`
// registry via @estate/db's PrismaPackSource. That table is intentionally NOT under
// RLS (CLAUDE.md §9), so the read runs on the base client by tenant id — not inside
// withTenant — exactly like getTenantName in tenant.ts.

/**
 * The FR-F-3 per-vertical extension listing types, each mapped to the optional pack that
 * authorises it (EPIC-AD). Authoring a vertical's extension fields is gated on its pack.
 */
const VERTICAL_LISTING_TYPE_PACK: Record<string, PackSlug> = {
  new_home: 'new_homes',
  commercial: 'commercial',
  business_transfer: 'business_transfer',
  care_home: 'care_homes',
};

/**
 * The current request's tenant's enabled optional-pack slugs (never includes the
 * implicit `core`). An unknown tenant yields an empty list.
 */
export async function getEnabledPacks(): Promise<string[]> {
  const tenantId = await getCurrentTenantId();
  const source = new PrismaPackSource(getDb() as unknown as TenantPackReader);
  return source.getEnabledPacks(tenantId);
}

/**
 * FR-F-3 — the vertical listing types the current tenant may author, gated through the
 * canonical `isPackEnabled` check (EPIC-AD / G12). The property admin form renders a
 * vertical's extension subsection only when its listing type is in this set, so the
 * pack decision lives server-side and the client never re-derives entitlement.
 */
export async function getEnabledVerticals(): Promise<string[]> {
  const tenantId = await getCurrentTenantId();
  const source = new PrismaPackSource(getDb() as unknown as TenantPackReader);
  const enabled: string[] = [];
  for (const [listingType, pack] of Object.entries(VERTICAL_LISTING_TYPE_PACK)) {
    if (await isPackEnabled(tenantId, pack, source)) enabled.push(listingType);
  }
  return enabled;
}
