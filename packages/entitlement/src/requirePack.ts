/**
 * `requirePack` — the throwing entitlement guard (EPIC-AD FR-AD-3 / FR-AD-11).
 *
 * Wraps {@link isPackEnabled} for the "fail-closed" case: a Server Action,
 * route handler, capability or worker calls `requirePack(...)` and, if the
 * pack is off for the tenant, a {@link PackNotEnabledError} is thrown for the
 * caller to translate into a 404 / 403 / redirect (per FR-AD-8/9/11).
 */

import { isPackEnabled } from './isPackEnabled.js';
import type { PackSlug } from './packs.js';
import type { PackSource } from './source.js';

/** Thrown by {@link requirePack} when a tenant lacks the required pack. */
export class PackNotEnabledError extends Error {
  /** The tenant the check was performed for. */
  readonly tenantId: string;
  /** The pack slug that was required but not enabled. */
  readonly packSlug: PackSlug;

  constructor(tenantId: string, packSlug: PackSlug) {
    super(`Pack '${packSlug}' is not enabled for tenant '${tenantId}'.`);
    this.name = 'PackNotEnabledError';
    this.tenantId = tenantId;
    this.packSlug = packSlug;
  }
}

/**
 * Assert that `packSlug` is enabled for `tenantId`.
 * @throws {PackNotEnabledError} when the pack is not enabled for the tenant.
 */
export async function requirePack(
  tenantId: string,
  packSlug: PackSlug,
  source: PackSource,
): Promise<void> {
  if (await isPackEnabled(tenantId, packSlug, source)) return;
  throw new PackNotEnabledError(tenantId, packSlug);
}
