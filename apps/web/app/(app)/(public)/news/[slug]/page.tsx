import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { PageRenderer } from '../../../../../components/blocks/PageRenderer.js';
import {
  getPublishedPostBySlug,
  postBodyToSections,
  type BlogReader,
  type PublishedPost,
} from '../../../lib/blog.js';
import { getDb } from '../../../lib/db.js';
import { blogPostingJsonLd, breadcrumbJsonLd, truncate } from '../../../lib/seo.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';
import { formatPublishedDate, toNewsQuery } from '../search-params.js';

export const dynamic = 'force-dynamic';

interface NewsArticlePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Load the post once per request — `generateMetadata` and the page component both
 * call this, and React's `cache` dedupes the tenant-scoped query.
 */
const loadPost = cache(async (slug: string): Promise<PublishedPost | null> => {
  const tenantId = await getCurrentTenantId();
  return withTenant(getDb(), tenantId, (tx) =>
    getPublishedPostBySlug(tx as unknown as BlogReader, slug),
  );
});

/** EPIC-O metadata (FR-O-4 / FR-C-11): from the post metaTitle / metaDescription. */
export async function generateMetadata({ params }: NewsArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return { title: 'Article not found' };

  const origin = await getRequestOrigin();
  const url = `${origin}/news/${post.slug}`;
  const title = truncate(post.metaTitle ?? post.title, 60);
  const description = truncate(post.metaDescription ?? post.excerpt ?? post.title, 160);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      ...(post.heroImageUrl ? { images: [post.heroImageUrl] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * EPIC-C C.14 knowledge-hub article (master spec §C; FR-C-11; FR-O-7). Resolves
 * the tenant, fetches the single published post by slug inside the tenant RLS
 * scope, and renders its body. The body is block-based Json mirroring the
 * page-builder's stored sections — rendered via the shared PageRenderer — or the
 * pre-rendered renderedHtmlCache when present (master spec §J). An unknown /
 * unpublished slug yields a 404; drafts never leak (the read model filters
 * status = published). Emits Article (BlogPosting) + BreadcrumbList JSON-LD.
 */
export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);

  if (!post) {
    notFound();
  }

  const origin = await getRequestOrigin();
  const url = `${origin}/news/${post.slug}`;
  const heroImageUrl = post.heroImageUrl;

  // EPIC-O structured data (FR-O-7 BlogPosting + FR-O-6 BreadcrumbList).
  const jsonLd = [
    blogPostingJsonLd(
      {
        title: post.title,
        description: post.metaDescription ?? post.excerpt,
        publishedAt: post.publishedAt,
        authorName: post.author?.name ?? null,
        imageUrl: heroImageUrl,
      },
      url,
    ),
    breadcrumbJsonLd([
      { name: 'Home', url: `${origin}/` },
      { name: 'Knowledge hub', url: `${origin}/news` },
      { name: post.title, url },
    ]),
  ];

  // Body rendering: prefer the pre-rendered HTML cache (master spec §J); otherwise
  // render the block-based body through the shared page renderer.
  const sections = postBodyToSections(post.body);

  return (
    <main id="main" className="container py-12">
      {jsonLd.map((ld, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Structured data is server-rendered, non-interactive JSON (no user input
          // is interpolated unescaped beyond the post's own text).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      <article className="mx-auto max-w-[70ch]">
        <nav aria-label="Breadcrumb" className="mb-6">
          <a href="/news" className="t-body-sm text-brand-primary underline underline-offset-4">
            ← Knowledge hub
          </a>
        </nav>

        <header className="mb-8 flex flex-col gap-3">
          {post.category ? (
            <a
              href={`/news${toNewsQuery({ category: post.category.slug })}`}
              className="t-caption text-brand-primary uppercase"
            >
              {post.category.name}
            </a>
          ) : null}
          <h1 className="t-display-sm">{post.title}</h1>
          <p className="t-caption text-text-secondary">
            {post.author ? <span>{post.author.name}</span> : null}
            {post.author && post.publishedAt ? <span aria-hidden="true"> · </span> : null}
            {post.publishedAt ? (
              <time dateTime={post.publishedAt.toISOString()}>
                {formatPublishedDate(post.publishedAt)}
              </time>
            ) : null}
          </p>
        </header>

        {heroImageUrl ? (
          <img
            src={heroImageUrl}
            alt={post.title}
            className="mb-8 aspect-[16/9] w-full rounded-lg object-cover"
          />
        ) : null}

        {post.renderedHtmlCache ? (
          <div
            className="t-body-lg text-text-secondary"
            // Pre-rendered, server-side body HTML (sanitised upstream by the CMS,
            // like the rich_text block renderer).
            dangerouslySetInnerHTML={{ __html: post.renderedHtmlCache }}
          />
        ) : (
          <PageRenderer sections={sections} />
        )}

        {post.tags.length > 0 ? (
          <ul aria-label="Tags" className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag.slug}>
                <a
                  href={`/news${toNewsQuery({ tag: tag.slug })}`}
                  className="t-body-sm bg-surface-sunken inline-flex items-center rounded-full px-3 py-1"
                >
                  {tag.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </main>
  );
}
