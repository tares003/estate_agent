import type { SeoScope } from '@estate/validators';

// EPIC-O FR-O-4 — the per-entity SEO-metadata read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors redirects.ts / saved-
// searches.ts); the live queries run tenant-scoped (RLS) via withTenant in the
// /admin/settings/seo route and (later) in public-page generateMetadata. Three
// reads: `listSeoMetadata` for the admin table (the default first, then entity
// overrides newest-first), `getSeoMetadata(scope, scopeId)` for the single-row
// lookup the editor loads, and `resolveSeoMetadata` — the override-else-default
// helper a public page CAN call to pick the effective metadata for an entity.

/** A persisted SEO override row, shaped for the admin table + the resolver. */
export interface SeoMetadataRow {
  id: string;
  scope: SeoScope;
  scopeId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
  noIndex: boolean;
  noFollow: boolean;
  structuredData: unknown;
}

/** Minimal read surface the list + lookups need (a Prisma tx satisfies it). */
export interface SeoMetadataReader {
  seoMetadata: {
    findMany(args: { orderBy?: unknown; take?: number }): Promise<SeoMetadataRow[]>;
    findFirst(args: { where: Record<string, unknown> }): Promise<SeoMetadataRow | null>;
  };
}

/** The most override rows to load into the admin table at once. */
const MAX_ROWS = 500;

/**
 * The tenant's SEO overrides for the admin table: the tenant-wide `default` row
 * first (when present), then the entity overrides newest-created-first. Tenant
 * scoping is applied by the caller (withTenant — RLS); this just shapes the query.
 */
export async function listSeoMetadata(reader: SeoMetadataReader): Promise<SeoMetadataRow[]> {
  return reader.seoMetadata.findMany({
    orderBy: [{ scope: 'asc' }, { createdAt: 'desc' }],
    take: MAX_ROWS,
  });
}

/**
 * The single override row for a scope (+ scopeId, null for `default`), or null if
 * none exists. This is the row the editor loads to pre-fill its fields. Tenant
 * scoping is applied by the caller (withTenant — RLS).
 */
export async function getSeoMetadata(
  reader: SeoMetadataReader,
  scope: SeoScope,
  scopeId: string | null = null,
): Promise<SeoMetadataRow | null> {
  return reader.seoMetadata.findFirst({ where: { scope, scopeId } });
}

/**
 * Resolve the effective SEO metadata for an entity: its own override when one
 * exists, otherwise the tenant-wide `default` row, otherwise null. This is the
 * helper a public page CAN call from generateMetadata to pick the metadata to
 * emit (wiring it into every public page is a separate follow-on). Tenant scoping
 * is applied by the caller (withTenant — RLS).
 */
export async function resolveSeoMetadata(
  reader: SeoMetadataReader,
  scope: SeoScope,
  scopeId: string,
): Promise<SeoMetadataRow | null> {
  const override = await getSeoMetadata(reader, scope, scopeId);
  if (override) return override;
  return getSeoMetadata(reader, 'default', null);
}
