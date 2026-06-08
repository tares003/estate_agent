/**
 * `isPackEnabled` — the canonical entitlement check (EPIC-AD FR-AD-3).
 *
 * Every code branch that depends on pack state consults this helper (or its
 * `requirePack` / `<RequirePack>` wrappers), never the raw entitlement field.
 * CI guard G12 enforces that contract.
 *
 * The implicit `core` pack is always enabled for every tenant; any other slug
 * is enabled only when the tenant's source lists it.
 */

import type { PackSlug } from './packs.js';
import type { PackSource } from './source.js';

/**
 * Resolve whether `packSlug` is enabled for `tenantId`.
 * @returns `true` for `core` (always), otherwise `true` iff the tenant's
 *   enabled packs include the slug.
 */
export async function isPackEnabled(
  tenantId: string,
  packSlug: PackSlug,
  source: PackSource,
): Promise<boolean> {
  if (packSlug === 'core') return true;
  const enabled = await source.getEnabledPacks(tenantId);
  return enabled.includes(packSlug);
}
