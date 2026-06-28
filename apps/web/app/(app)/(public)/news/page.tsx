import type { Metadata } from 'next';
import { withTenant } from '@estate/db';
import { getDb } from '../../lib/db.js';
import { listPublishedPosts, type BlogListOptions, type BlogReader } from '../../lib/blog.js';
import { getCurrentTenantId, getRequestOrigin } from '../../lib/tenant.js';
import { formatPublishedDate, parseBlogSearch, toNewsQuery } from './search-params.js';

export const dynamic = 'force-dynamic';

/** EPIC-O metadata for the knowledge hub index (FR-O-4 / FR-C-11). */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/news`;
  const title = 'Knowledge hub';
  const description =
    'Property market insight, guides and advice for buyers, sellers, tenants and landlords.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

interface NewsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Map the parsed URL filters to the read-model options (omit unset keys). */
function toOptions(search: ReturnType<typeof parseBlogSearch>): BlogListOptions {
  return {
    page: search.page,
    ...(search.category ? { category: search.category } : {}),
    ...(search.tag ? { tag: search.tag } : {}),
  };
}

/**
 * EPIC-C C.14 knowledge-hub index (master spec §C.10 / FR-C-10). URL-driven
 * category / tag filter + pagination: the query string is the single source of
 * truth. Resolves the tenant, lists published posts inside the tenant RLS scope,
 * and renders the post-card grid + pagination. Drafts never appear (the read
 * model filters status = published). The query/mapping logic is unit-tested in
 * lib/blog.ts and search-params.ts; this composes it.
 */
export default async function NewsPage({ searchParams }: NewsPageProps) {
  const search = parseBlogSearch((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listPublishedPosts(tx as unknown as BlogReader, toOptions(search)),
  );

  const { items, total, page, totalPages } = result;

  return (
    <main id="main" className="container py-12">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="t-display-sm">Knowledge hub</h1>
        <p className="t-body-lg text-text-secondary max-w-[60ch]">
          Property market insight, guides and advice from our team.
        </p>
      </header>

      {search.category || search.tag ? (
        <p className="mb-6">
          <a
            href="/news"
            className="t-body-sm text-brand-primary underline underline-offset-4"
            aria-label="Clear filter"
          >
            ← All articles
          </a>
        </p>
      ) : null}

      <p className="t-body-sm text-text-secondary mb-6" aria-live="polite">
        {total === 0 ? 'No articles' : `${total} ${total === 1 ? 'article' : 'articles'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No articles to show just yet. Please check back soon.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <li key={post.slug}>
              <article className="border-divider flex h-full flex-col gap-3 rounded-lg border p-6">
                {post.heroImageUrl ? (
                  <img
                    src={post.heroImageUrl}
                    alt={post.title}
                    className="aspect-[16/9] w-full rounded-md object-cover"
                  />
                ) : null}
                {post.category ? (
                  <a
                    href={`/news${toNewsQuery({ category: post.category.slug })}`}
                    className="t-caption text-brand-primary uppercase"
                  >
                    {post.category.name}
                  </a>
                ) : null}
                <h2 className="t-heading-sm">
                  <a href={`/news/${post.slug}`} className="underline-offset-4 hover:underline">
                    {post.title}
                  </a>
                </h2>
                {post.excerpt ? (
                  <p className="t-body-md text-text-secondary max-w-[55ch]">{post.excerpt}</p>
                ) : null}
                <p className="t-caption text-text-secondary mt-auto">
                  {post.author ? <span>{post.author.name}</span> : null}
                  {post.author && post.publishedAt ? <span aria-hidden="true"> · </span> : null}
                  {post.publishedAt ? (
                    <time dateTime={post.publishedAt.toISOString()}>
                      {formatPublishedDate(post.publishedAt)}
                    </time>
                  ) : null}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a className="t-body-md" href={`/news${toNewsQuery(search, { page: page - 1 })}`}>
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a className="t-body-md" href={`/news${toNewsQuery(search, { page: page + 1 })}`}>
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
