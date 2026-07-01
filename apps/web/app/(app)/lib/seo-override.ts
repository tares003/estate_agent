import type { Metadata } from 'next';

import type { SeoMetadataRow } from './seo-metadata.js';

// EPIC-O FR-O-4 — the thin merge layer that applies a resolved per-entity SEO
// override (metaTitle / metaDescription / canonicalUrl / ogImage / noIndex /
// noFollow) OVER a public page's default `Metadata`. Pure + IO-free (mirrors
// lib/seo.ts), so it unit-tests in isolation and each public `generateMetadata`
// stays a thin composition. Precedence is override-wins-when-present: a set
// override field replaces the default; an absent one leaves today's default
// untouched. `resolveSeoMetadata` (lib/seo-metadata.ts) supplies the row —
// the entity's own override, else the tenant-wide `default`, else null.

/** The override fields this layer merges (a `SeoMetadataRow` satisfies it). */
export type SeoOverride = Pick<
  SeoMetadataRow,
  'metaTitle' | 'metaDescription' | 'canonicalUrl' | 'ogImage' | 'noIndex' | 'noFollow'
>;

/** Treat null / undefined / empty-after-trim as "not set". */
function isSet(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Apply a resolved SEO override over a page's default `Metadata`. Returns a new
 * object (never mutates `base`). For each field the override wins only when it
 * carries a value; otherwise the base is preserved unchanged:
 *
 * - `metaTitle` → `title` (+ `openGraph.title` + `twitter.title`)
 * - `metaDescription` → `description` (+ `openGraph.description` + `twitter.description`)
 * - `canonicalUrl` → `alternates.canonical`
 * - `ogImage` → `openGraph.images` (a single-image array; also `twitter.images`)
 * - `noIndex` / `noFollow` → `robots` `{ index, follow }`, emitted only when
 *   either flag is set (so pages without an override keep today's no-robots-meta
 *   behaviour).
 *
 * A null `override` returns `base` unchanged.
 */
export function applySeoOverride(base: Metadata, override: SeoOverride | null): Metadata {
  if (!override) return base;

  const next: Metadata = { ...base };

  if (isSet(override.metaTitle)) {
    next.title = override.metaTitle;
  }
  if (isSet(override.metaDescription)) {
    next.description = override.metaDescription;
  }

  if (isSet(override.canonicalUrl)) {
    next.alternates = { ...base.alternates, canonical: override.canonicalUrl };
  }

  const ogTitle = isSet(override.metaTitle) ? override.metaTitle : undefined;
  const ogDescription = isSet(override.metaDescription) ? override.metaDescription : undefined;
  const ogImage = isSet(override.ogImage) ? override.ogImage : undefined;

  if (base.openGraph && (ogTitle || ogDescription || ogImage)) {
    next.openGraph = {
      ...base.openGraph,
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    };
  }

  if (base.twitter && (ogTitle || ogDescription || ogImage)) {
    next.twitter = {
      ...base.twitter,
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    };
  }

  if (override.noIndex || override.noFollow) {
    next.robots = { index: !override.noIndex, follow: !override.noFollow };
  }

  return next;
}
