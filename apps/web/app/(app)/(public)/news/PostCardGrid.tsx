import type { BlogPostCard } from '../../lib/blog.js';
import { formatPublishedDate, toNewsQuery } from './search-params.js';

// Shared knowledge-hub card grid + pagination (master spec §C.10 / §C.14). The
// /news index inlines its own copy; the category / tag ARCHIVE routes render
// through here so they reuse the identical card layout, published-date display
// and pagination discipline. `basePath` is the archive's own path (e.g.
// `/news/category/market-insight`) so the pagination links stay on the archive
// rather than jumping back to the unfiltered index.

interface PostCardGridProps {
  items: BlogPostCard[];
  page: number;
  totalPages: number;
  /** The archive's own path — pagination links append `?page=N` to this. */
  basePath: string;
}

/** A `?page=N` query for the archive (page 1 is the canonical bare path). */
function pageQuery(page: number): string {
  return page > 1 ? `?page=${page}` : '';
}

/** The post-card grid plus its pagination nav, shared across the archive routes. */
export function PostCardGrid({ items, page, totalPages, basePath }: PostCardGridProps) {
  return (
    <>
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

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a className="t-body-md" href={`${basePath}${pageQuery(page - 1)}`}>
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a className="t-body-md" href={`${basePath}${pageQuery(page + 1)}`}>
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
