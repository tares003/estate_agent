// Pure helpers for the URL-driven knowledge hub: parse the raw search params into
// a typed filter, serialise the active filter back to a query string (the URL is
// the single source of truth — master spec §C.10), and format a publication date
// for display. No DB, no React — unit-tested in isolation so the /news route stays
// a thin composition.

/** The parsed knowledge-hub filter (category / tag slug + page). */
export interface BlogSearch {
  category?: string;
  tag?: string;
  page: number;
}

/** Slugs are lowercase letters, digits and hyphens (matches the §J slug shape). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Read the first value of a possibly-repeated search param. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Coerce a raw `page` param to a positive integer (defaults to 1). */
function parsePage(value: string | string[] | undefined): number {
  const raw = first(value);
  const page = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Keep a slug param only when it matches the slug shape (else drop it). */
function parseSlug(value: string | string[] | undefined): string | undefined {
  const raw = first(value)?.toLowerCase();
  return raw && SLUG.test(raw) ? raw : undefined;
}

/**
 * Parse the raw `/news` search params into a typed filter. Unknown / malformed
 * values are dropped so the route never trusts the query string blindly. Under
 * exactOptionalPropertyTypes, absent filters are omitted rather than set to
 * undefined.
 */
export function parseBlogSearch(raw: Record<string, string | string[] | undefined>): BlogSearch {
  const category = parseSlug(raw['category']);
  const tag = parseSlug(raw['tag']);
  return {
    page: parsePage(raw['page']),
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
  };
}

/** Overrides for {@link toNewsQuery} — each key may be cleared with `undefined`. */
type NewsOverrides = { [K in keyof BlogSearch]?: BlogSearch[K] | undefined };

/**
 * Serialise an active filter to a `/news` query string (leading `?`, or `''` when
 * nothing is active). `page=1` is the default and is omitted, so the canonical
 * "no filters" URL is just `/news`. `overrides` are applied last (e.g. `{ page: 2 }`
 * for a pagination link).
 */
export function toNewsQuery(
  search: Partial<BlogSearch> = {},
  overrides: NewsOverrides = {},
): string {
  const merged = { ...search, ...overrides };
  const params = new URLSearchParams();
  if (merged.category) params.set('category', merged.category);
  if (merged.tag) params.set('tag', merged.tag);
  if (merged.page !== undefined && merged.page > 1) params.set('page', String(merged.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Fixed-locale date formatter (deterministic in tests / across runtimes). */
const PUBLISHED_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Format a post's publication date for display (e.g. "1 March 2026"). */
export function formatPublishedDate(date: Date): string {
  return PUBLISHED_DATE.format(date);
}
