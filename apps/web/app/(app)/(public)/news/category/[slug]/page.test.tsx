// responsive-coverage: opt-out all — this asserts the data → archive composition,
// the category heading, the 404 path and the empty state; the responsive card
// grid is covered by the /news page-level Playwright e2e pass (design-requirements
// §3) and the shared PostCardGrid it renders.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const categoryFindFirst = vi.fn();
const postFindMany = vi.fn();
const postCount = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      blogCategory: { findFirst: categoryFindFirst },
      blogPost: { findMany: postFindMany, count: postCount },
    }),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

const { default: CategoryArchivePage, generateMetadata } = await import('./page.js');

const post = {
  id: 'p1',
  slug: 'spring-market-2026',
  title: 'The spring market in 2026',
  excerpt: 'A look at the spring market.',
  heroImageUrl: 'https://acme.test/img/spring.jpg',
  publishedAt: new Date('2026-03-01T09:00:00Z'),
  metaTitle: null,
  metaDescription: null,
  body: [],
  renderedHtmlCache: null,
  category: { name: 'Market insight', slug: 'market-insight' },
  author: { name: 'Jo Bloggs', slug: 'jo-bloggs' },
  tags: [],
};

const category = { name: 'Market insight', slug: 'market-insight' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CategoryArchivePage', () => {
  it('renders the category name as the heading and the filtered post cards', async () => {
    categoryFindFirst.mockResolvedValue(category);
    postFindMany.mockResolvedValue([post]);
    postCount.mockResolvedValue(1);

    render(
      await CategoryArchivePage({
        params: Promise.resolve({ slug: 'market-insight' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(categoryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'market-insight' } }),
    );
    // The list is filtered to the category and to published posts only.
    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', category: { slug: 'market-insight' } },
      }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Market insight' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The spring market in 2026' })).toHaveAttribute(
      'href',
      '/news/spring-market-2026',
    );
    expect(screen.getByText('1 article')).toBeInTheDocument();
  });

  it('paginates within the archive path (not back to /news)', async () => {
    categoryFindFirst.mockResolvedValue(category);
    postFindMany.mockResolvedValue([post]);
    postCount.mockResolvedValue(25);

    render(
      await CategoryArchivePage({
        params: Promise.resolve({ slug: 'market-insight' }),
        searchParams: Promise.resolve({ page: '2' }),
      }),
    );

    expect(screen.getByText('Page 2 of 3')).toHaveTextContent('Page 2 of 3');
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/news/category/market-insight',
    );
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/news/category/market-insight?page=3',
    );
  });

  it('renders the empty state when the category has no published posts', async () => {
    categoryFindFirst.mockResolvedValue(category);
    postFindMany.mockResolvedValue([]);
    postCount.mockResolvedValue(0);

    render(
      await CategoryArchivePage({
        params: Promise.resolve({ slug: 'market-insight' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText('No articles')).toBeInTheDocument();
    expect(screen.getByText(/No articles in this category just yet/i)).toBeInTheDocument();
  });

  it('calls notFound() for an unknown category slug', async () => {
    categoryFindFirst.mockResolvedValue(null);

    await expect(
      CategoryArchivePage({
        params: Promise.resolve({ slug: 'ghost' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    // The post list is never queried when the category is unknown.
    expect(postFindMany).not.toHaveBeenCalled();
  });

  describe('generateMetadata', () => {
    it('builds canonical / OG / Twitter metadata from the category name', async () => {
      categoryFindFirst.mockResolvedValue(category);

      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'market-insight' }) });

      expect(meta.title).toBe('Market insight — Knowledge hub');
      expect(meta.alternates?.canonical).toBe('https://acme.test/news/category/market-insight');
      expect(meta.openGraph?.url).toBe('https://acme.test/news/category/market-insight');
      expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    });

    it('returns a not-found title for an unknown category slug', async () => {
      categoryFindFirst.mockResolvedValue(null);
      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ghost' }) });
      expect(meta.title).toBe('Category not found');
    });
  });
});
