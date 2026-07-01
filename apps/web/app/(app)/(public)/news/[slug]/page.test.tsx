// responsive-coverage: opt-out all — this asserts the data → article composition,
// the JSON-LD emission, the body-rendering fallback and the 404 path; the
// responsive reading layout is covered by the page-level Playwright e2e pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const findFirst = vi.fn();
const seoFindFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ blogPost: { findFirst }, seoMetadata: { findFirst: seoFindFirst } }),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

// Stand in for the shared block renderer so we can assert the fallback path.
vi.mock('../../../../../components/blocks/PageRenderer.js', () => ({
  PageRenderer: ({ sections }: { sections: Array<{ type: string }> }) => (
    <div data-testid="page-renderer">{sections.map((s) => s.type).join(',')}</div>
  ),
}));

const { default: NewsArticlePage, generateMetadata } = await import('./page.js');

const post = {
  id: 'p1',
  slug: 'spring-market-2026',
  title: 'The spring market in 2026',
  excerpt: 'A look at the spring market.',
  heroImageUrl: 'https://acme.test/img/spring.jpg',
  publishedAt: new Date('2026-03-01T09:00:00Z'),
  metaTitle: 'Spring market 2026',
  metaDescription: 'What buyers and sellers can expect this spring.',
  body: [{ type: 'rich_text', data: { html: '<p>Hi</p>' } }],
  renderedHtmlCache: null,
  category: { name: 'Market insight', slug: 'market-insight' },
  author: { name: 'Jo Bloggs', slug: 'jo-bloggs' },
  tags: [{ name: 'Sales', slug: 'sales' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  seoFindFirst.mockResolvedValue(null);
});

describe('NewsArticlePage', () => {
  it('renders the article and emits BlogPosting + BreadcrumbList JSON-LD (FR-O-7)', async () => {
    findFirst.mockResolvedValue(post);

    const { container } = render(
      await NewsArticlePage({ params: Promise.resolve({ slug: 'spring-market-2026' }) }),
    );

    // The detail read filters to published posts only (drafts never leak).
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'spring-market-2026', status: 'published' } }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'The spring market in 2026' }),
    ).toBeInTheDocument();

    const ldScripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(ldScripts).toHaveLength(2);
    const article = JSON.parse(ldScripts[0]?.textContent ?? '{}');
    expect(article['@type']).toBe('BlogPosting');
    expect(article.headline).toBe('The spring market in 2026');
    expect(article.url).toBe('https://acme.test/news/spring-market-2026');
    expect(article.datePublished).toBe('2026-03-01T09:00:00.000Z');
    expect(article.author).toMatchObject({ '@type': 'Person', name: 'Jo Bloggs' });
    expect(JSON.parse(ldScripts[1]?.textContent ?? '{}')['@type']).toBe('BreadcrumbList');

    // A tag link points back to the filtered hub.
    expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute('href', '/news?tag=sales');
  });

  it('renders the block-based body via the PageRenderer when there is no HTML cache', async () => {
    findFirst.mockResolvedValue(post);

    render(await NewsArticlePage({ params: Promise.resolve({ slug: 'spring-market-2026' }) }));

    expect(screen.getByTestId('page-renderer')).toHaveTextContent('rich_text');
  });

  it('prefers the pre-rendered renderedHtmlCache when present (master spec §J)', async () => {
    findFirst.mockResolvedValue({
      ...post,
      renderedHtmlCache: '<p data-testid="cached">Cached body</p>',
    });

    render(await NewsArticlePage({ params: Promise.resolve({ slug: 'spring-market-2026' }) }));

    expect(screen.getByTestId('cached')).toHaveTextContent('Cached body');
    expect(screen.queryByTestId('page-renderer')).not.toBeInTheDocument();
  });

  it('calls notFound() when the slug resolves to no published post', async () => {
    findFirst.mockResolvedValue(null);

    await expect(NewsArticlePage({ params: Promise.resolve({ slug: 'ghost' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  describe('generateMetadata', () => {
    it('builds metadata from the post metaTitle / metaDescription (FR-O-4)', async () => {
      findFirst.mockResolvedValue(post);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'spring-market-2026' }),
      });

      expect(meta.title).toBe('Spring market 2026');
      expect(meta.alternates?.canonical).toBe('https://acme.test/news/spring-market-2026');
      expect(meta.openGraph?.url).toBe('https://acme.test/news/spring-market-2026');
      expect((meta.openGraph as { type?: string } | undefined)?.type).toBe('article');
      expect((meta.description ?? '').length).toBeLessThanOrEqual(160);
    });

    it('returns a not-found title when the slug is unknown', async () => {
      findFirst.mockResolvedValue(null);
      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ghost' }) });
      expect(meta.title).toBe('Article not found');
    });

    it('applies a per-post SEO override over the defaults (FR-O-4)', async () => {
      findFirst.mockResolvedValue(post);
      seoFindFirst.mockResolvedValue({
        id: 's1',
        scope: 'blog_post',
        scopeId: post.id,
        metaTitle: 'Override headline',
        metaDescription: 'Override snippet.',
        canonicalUrl: 'https://acme.test/canonical/spring',
        ogImage: 'https://acme.test/social/spring.jpg',
        noIndex: false,
        noFollow: true,
        structuredData: null,
      });

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: 'spring-market-2026' }),
      });

      expect(seoFindFirst).toHaveBeenCalledWith({
        where: { scope: 'blog_post', scopeId: post.id },
      });
      expect(meta.title).toBe('Override headline');
      expect(meta.description).toBe('Override snippet.');
      expect(meta.alternates?.canonical).toBe('https://acme.test/canonical/spring');
      expect((meta.openGraph as { images?: unknown[] }).images).toEqual([
        'https://acme.test/social/spring.jpg',
      ]);
      expect(meta.robots).toEqual({ index: true, follow: false });
    });
  });
});
