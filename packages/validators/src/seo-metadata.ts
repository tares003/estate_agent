import { z } from 'zod';

// EPIC-O FR-O-4 — the per-entity SEO-metadata override schema. Staff override the
// meta title / description, canonical URL, Open Graph image, the noindex / nofollow
// flags and any structured-data (JSON-LD) overrides for a single scoped entity
// (a page / property / area guide / blog post / branch) or the tenant-wide `default`
// fallback (scope `default`, no scopeId). The schema is the single gate between the
// admin SEO editor and persistence. Pure configuration — captures NO personal data,
// so it carries no GDPR-consent affirmation, and (an authenticated admin action) no
// Turnstile.
//
// `scope` mirrors the Prisma `SeoScope` enum (the schema is the source of truth, G6).
// `scopeId` is the id of the scoped entity, and is REQUIRED for every scope EXCEPT
// `default` (the tenant-wide fallback, which has no entity — its scopeId is null).
// The character ceilings on the title (≤ 60) and description (≤ 160) match the SERP
// discipline (FR-O-4); the editor's live counters share these constants.

/** The SEO scopes, mirroring the Prisma `SeoScope` enum. */
export const SEO_SCOPES = [
  'page',
  'property',
  'area_guide',
  'blog_post',
  'branch',
  'default',
] as const;

/** A single SEO scope. */
export type SeoScope = (typeof SEO_SCOPES)[number];

/** Recommended SERP meta-title ceiling (FR-O-4); the editor counter shares it. */
export const SEO_META_TITLE_MAX = 60;

/** Recommended SERP meta-description ceiling (FR-O-4); the editor counter shares it. */
export const SEO_META_DESCRIPTION_MAX = 160;

/** Upper bound for the canonical / OG-image URL fields (bounds storage). */
export const SEO_URL_MAX = 2048;

/** Trim a string, treating an empty / whitespace-only value as "not set" (→ undefined). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

/** An optional absolute / root-relative URL the editor leaves blank when unset. */
const optionalUrl = z
  .string()
  .trim()
  .max(SEO_URL_MAX)
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

/**
 * Upsert a per-entity SEO override (the editor's create + edit form). `scopeId` is
 * required for every entity scope and must be absent / null for the `default`
 * fallback; the refinement keeps the two consistent so a "default" row can never
 * carry an entity id and an entity override can never miss one.
 */
export const seoMetadataUpsertSchema = z
  .object({
    scope: z.enum(SEO_SCOPES),
    scopeId: z.string().uuid().nullish(),
    metaTitle: optionalText(SEO_META_TITLE_MAX),
    metaDescription: optionalText(SEO_META_DESCRIPTION_MAX),
    canonicalUrl: optionalUrl,
    ogImage: optionalUrl,
    noIndex: z.boolean().default(false),
    noFollow: z.boolean().default(false),
    structuredData: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'default') {
      if (value.scopeId != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['scopeId'],
          message: 'The default override applies tenant-wide and takes no entity.',
        });
      }
    } else if (value.scopeId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scopeId'],
        message: 'Choose the entity this override applies to.',
      });
    }
  });

/** A validated SEO-metadata upsert input. */
export type SeoMetadataUpsert = z.infer<typeof seoMetadataUpsertSchema>;
