import type { PageSection } from '../../../components/blocks/PageRenderer.js';

// EPIC-C C.14 knowledge-hub read model (master spec §C; §J Blog post). Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// properties.ts / saved-properties.ts); the live queries run tenant-scoped (RLS)
// via withTenant in the /news routes. Only published posts are ever returned —
// drafts and scheduled posts never leak to the public site. The post `body` is
// the block-based Json that mirrors how the page-builder stores typed sections
// ({ type, data }[]); the route renders it via the shared PageRenderer, or the
// pre-rendered renderedHtmlCache when present (master spec §J).

/** The BlogPost columns the knowledge hub reads (the published subset). */
export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  body: unknown;
  renderedHtmlCache: string | null;
  excerpt: string | null;
  heroImageUrl: string | null;
  publishedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string; slug: string } | null;
  tags: Array<{ name: string; slug: string }>;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface BlogReader {
  blogPost: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
      include?: Record<string, unknown>;
    }): Promise<BlogPostRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    findFirst(args: {
      where?: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<BlogPostRow | null>;
  };
}

/** A knowledge-hub card: the fields the list surface renders per post. */
export interface BlogPostCard {
  slug: string;
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  publishedAt: Date | null;
  category: { name: string; slug: string } | null;
  author: { name: string; slug: string } | null;
}

/** A full published post: the card fields plus the body + SEO + taxonomy. */
export interface PublishedPost extends BlogPostCard {
  id: string;
  body: unknown;
  renderedHtmlCache: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: Array<{ name: string; slug: string }>;
}

/** A page of knowledge-hub cards plus the totals the UI needs to paginate. */
export interface BlogListResult {
  items: BlogPostCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The knowledge-hub list filters (master spec §C.10 — category filter + paging). */
export interface BlogListOptions {
  /** Category slug to filter by (optional). */
  category?: string;
  /** Tag slug to filter by (optional). */
  tag?: string;
  page?: number;
  pageSize?: number;
}

/** The default knowledge-hub page size (master spec §C.10 "configured page size"). */
export const BLOG_PAGE_SIZE = 9;

/** Clamp `value` into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The relation tree the list/detail reads need (category + author + tags). */
const POST_INCLUDE = {
  category: { select: { name: true, slug: true } },
  author: { select: { name: true, slug: true } },
  tags: { select: { name: true, slug: true } },
} as const;

/** Build the Prisma `where` for the published list (status + optional taxonomy). */
function buildListWhere(options: BlogListOptions): Record<string, unknown> {
  // Base predicate: only published posts are public (drafts / scheduled excluded).
  const where: Record<string, unknown> = { status: 'published' };
  if (options.category) where['category'] = { slug: options.category };
  if (options.tag) where['tags'] = { some: { slug: options.tag } };
  return where;
}

/** Map a published row to its list-card view model (drops body + SEO). */
function toCard(row: BlogPostRow): BlogPostCard {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    heroImageUrl: row.heroImageUrl,
    publishedAt: row.publishedAt,
    category: row.category,
    author: row.author,
  };
}

/**
 * List published knowledge-hub posts, newest-published first, one page at a time
 * (master spec §C.10). Optional category / tag slug filters. Returns the mapped
 * cards plus the totals the UI paginates with. The query runs tenant-scoped (RLS)
 * via withTenant in the route; here the client is structural so it is DB-free to
 * test. Drafts and scheduled posts are never returned.
 */
export async function listPublishedPosts(
  db: BlogReader,
  options: BlogListOptions = {},
): Promise<BlogListResult> {
  const where = buildListWhere(options);
  const pageSize = clamp(options.pageSize ?? BLOG_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: pageSize,
      include: POST_INCLUDE,
    }),
    db.blogPost.count({ where }),
  ]);

  return {
    items: rows.map(toCard),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Fetch a single PUBLISHED knowledge-hub post by slug, or null if none. Filters
 * by `status: published` so a draft or scheduled post never leaks via its slug
 * (RLS scopes the query to the tenant). Returns the full post — body + SEO meta +
 * taxonomy — for the detail surface.
 */
export async function getPublishedPostBySlug(
  db: BlogReader,
  slug: string,
): Promise<PublishedPost | null> {
  const row = await db.blogPost.findFirst({
    where: { slug, status: 'published' },
    include: POST_INCLUDE,
  });
  if (!row) return null;
  return {
    ...toCard(row),
    id: row.id,
    body: row.body,
    renderedHtmlCache: row.renderedHtmlCache,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    tags: row.tags,
  };
}

/**
 * Coerce a stored post `body` into the PageRenderer section shape. The body
 * mirrors how the page-builder stores typed sections — an array of
 * `{ type, data }`. Anything that is not that shape (legacy / empty bodies)
 * yields no sections, so the detail route falls back to renderedHtmlCache or an
 * empty body rather than throwing. Pure + IO-free.
 */
export function postBodyToSections(body: unknown): PageSection[] {
  if (!Array.isArray(body)) return [];
  const sections: PageSection[] = [];
  for (const entry of body) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { type?: unknown }).type === 'string'
    ) {
      const candidate = entry as { type: string; data?: unknown };
      sections.push({ type: candidate.type, data: candidate.data });
    }
  }
  return sections;
}
