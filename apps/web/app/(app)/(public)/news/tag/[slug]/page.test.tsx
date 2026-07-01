// responsive-coverage: opt-out all — this asserts the data → archive composition,
// the tag heading, the 404 path and the empty state; the responsive card grid is
// covered by the /news page-level Playwright e2e pass (design-requirements §3) and
// the shared PostCardGrid it renders.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const tagFindFirst = vi.fn();
const postFindMany = vi.fn();
const postCount = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      blogPostTag: { findFirst: tagFindFirst },
      blogPost: { findMany: postFindMany, count: postCount },
    }),
}));

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound }));

const { default: TagArchivePage, generateMetadata } = await import('./page.js');

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

const tag = { name: 'Sales', slug: 'sales' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TagArchivePage', () => {
  it('renders the tag name as the heading and the filtered post cards', async () => {
    tagFindFirst.mockResolvedValue(tag);
    postFindMany.mockResolvedValue([post]);
    postCount.mockResolvedValue(1);

    render(
      await TagArchivePage({
        params: Promise.resolve({ slug: 'sales' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(tagFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'sales' } }),
    );
    // The list is filtered to the tag (some-relation) and to published posts only.
    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', tags: { some: { slug: 'sales' } } },
      }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The spring market in 2026' })).toHaveAttribute(
      'href',
      '/news/spring-market-2026',
    );
    expect(screen.getByText('1 article')).toBeInTheDocument();
  });

  it('paginates within the archive path (not back to /news)', async () => {
    tagFindFirst.mockResolvedValue(tag);
    postFindMany.mockResolvedValue([post]);
    postCount.mockResolvedValue(25);

    render(
      await TagArchivePage({
        params: Promise.resolve({ slug: 'sales' }),
        searchParams: Promise.resolve({ page: '2' }),
      }),
    );

    expect(screen.getByText('Page 2 of 3')).toHaveTextContent('Page 2 of 3');
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/news/tag/sales',
    );
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/news/tag/sales?page=3',
    );
  });

  it('renders the empty state when the tag has no published posts', async () => {
    tagFindFirst.mockResolvedValue(tag);
    postFindMany.mockResolvedValue([]);
    postCount.mockResolvedValue(0);

    render(
      await TagArchivePage({
        params: Promise.resolve({ slug: 'sales' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText('No articles')).toBeInTheDocument();
    expect(screen.getByText(/No articles with this tag just yet/i)).toBeInTheDocument();
  });

  it('calls notFound() for an unknown tag slug', async () => {
    tagFindFirst.mockResolvedValue(null);

    await expect(
      TagArchivePage({
        params: Promise.resolve({ slug: 'ghost' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(postFindMany).not.toHaveBeenCalled();
  });

  describe('generateMetadata', () => {
    it('builds canonical / OG / Twitter metadata from the tag name', async () => {
      tagFindFirst.mockResolvedValue(tag);

      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'sales' }) });

      expect(meta.title).toBe('Sales — Knowledge hub');
      expect(meta.alternates?.canonical).toBe('https://acme.test/news/tag/sales');
      expect(meta.openGraph?.url).toBe('https://acme.test/news/tag/sales');
      expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    });

    it('returns a not-found title for an unknown tag slug', async () => {
      tagFindFirst.mockResolvedValue(null);
      const meta = await generateMetadata({ params: Promise.resolve({ slug: 'ghost' }) });
      expect(meta.title).toBe('Tag not found');
    });
  });
});
