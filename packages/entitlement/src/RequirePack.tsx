/**
 * `<RequirePack>` — route- and section-level entitlement gating (EPIC-AD
 * FR-AD-9 / FR-AD-13). An async React Server Component that renders its
 * children only when the pack is enabled for the tenant, otherwise the
 * `fallback` (or nothing).
 *
 * Server Components may be async functions; this returns the children element
 * directly (or the fallback / null) so it composes inside any Server Component
 * tree. The `isPackEnabled` call below is also what satisfies CI guard G12 for
 * this file.
 */

import type { ReactElement, ReactNode } from 'react';
import { isPackEnabled } from './isPackEnabled.js';
import type { PackSlug } from './packs.js';
import type { PackSource } from './source.js';

/** Props for {@link RequirePack}. */
export interface RequirePackProps {
  /** The pack the gated content requires. */
  pack: PackSlug;
  /** The tenant whose entitlement is checked. */
  tenantId: string;
  /** Entitlement source (Prisma-backed in production; in-memory in tests). */
  source: PackSource;
  /** Content shown when the pack is enabled. */
  children: ReactNode;
  /** Content shown when the pack is off; defaults to nothing. */
  fallback?: ReactNode;
}

/**
 * Render `children` when `pack` is enabled for `tenantId`, otherwise `fallback`
 * (or `null`).
 */
export async function RequirePack({
  pack,
  tenantId,
  source,
  children,
  fallback = null,
}: RequirePackProps): Promise<ReactElement | null> {
  const enabled = await isPackEnabled(tenantId, pack, source);
  return (enabled ? children : fallback) as ReactElement | null;
}
