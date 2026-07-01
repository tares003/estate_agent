import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import {
  getPublishedCategoryBySlug,
  listPublishedPostsByCategory,
  type BlogListResult,
  type BlogReader,
  type BlogTaxonomyReader,
  type BlogTermRow,
} from '../../../../lib/blog.js';
import { getDb } from '../../../../lib/db.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../../lib/tenant.js';
import { parseBlogSearch } from '../../search-params.js';
import { PostCardGrid } from '../../PostCardGrid.js';

export const dynamic = 'force-dynamic';

interface CategoryArchiveProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolve the category once per request — `generateMetadata` and the page both
 * call this, and React's `cache` dedupes the tenant-scoped lookup. An unknown /
 * empty slug resolves to null and both surfaces 404.
 */
const loadCategory = cache(async (slug: string): Promise<BlogTermRow | null> => {
  const tenantId = await getCurrentTenantId();
  return withTenant(getDb(), tenantId, (tx) =>
    getPublishedCategoryBySlug(tx as unknown as BlogTaxonomyReader, slug),
  );
});

/** EPIC-O metadata for a category archive (FR-O-4 / FR-C-11). 404 → no-index title. */
export async function generateMetadata({ params }: CategoryArchiveProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) return { title: 'Category not found' };

  const origin = await getRequestOrigin();
  const url = `${origin}/news/category/${category.slug}`;
  const title = `${category.name} — Knowledge hub`;
  const description = `Articles filed under ${category.name} from our knowledge hub.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * EPIC-C C.14 knowledge-hub CATEGORY archive (master spec §C). Resolves the
 * tenant, looks up the category by slug inside the tenant RLS scope, and — when
 * it exists — lists the published posts filed under it (newest first, paginated),
 * reusing the /news index card grid + pagination. An unknown / empty category
 * slug yields a 404. A valid category with no published posts shows the empty
 * state. Drafts never leak (the read model filters status = published).
 */
export default async function CategoryArchivePage({ params, searchParams }: CategoryArchiveProps) {
  const { slug } = await params;
  const category = await loadCategory(slug);
  if (!category) {
    notFound();
  }

  const search = parseBlogSearch((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result: BlogListResult = await withTenant(getDb(), tenantId, (tx) =>
    listPublishedPostsByCategory(tx as unknown as BlogReader, category.slug, { page: search.page }),
  );

  const { items, total, page, totalPages } = result;
  const basePath = `/news/category/${category.slug}`;

  return (
    <main id="main" className="container py-12">
      <header className="mb-10 flex flex-col gap-2">
        <p className="t-caption text-brand-primary uppercase">Category</p>
        <h1 className="t-display-sm">{category.name}</h1>
      </header>

      <p className="mb-6">
        <a
          href="/news"
          className="t-body-sm text-brand-primary underline underline-offset-4"
          aria-label="Back to knowledge hub"
        >
          ← All articles
        </a>
      </p>

      <p className="t-body-sm text-text-secondary mb-6" aria-live="polite">
        {total === 0 ? 'No articles' : `${total} ${total === 1 ? 'article' : 'articles'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No articles in this category just yet. Please check back soon.
        </p>
      ) : (
        <PostCardGrid items={items} page={page} totalPages={totalPages} basePath={basePath} />
      )}
    </main>
  );
}
