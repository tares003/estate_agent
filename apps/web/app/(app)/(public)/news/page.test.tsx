// responsive-coverage: opt-out all — this asserts the data → list composition,
// the filter / pagination links and the empty state; the responsive card grid is
// covered by the page-level Playwright e2e pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ blogPost: { findMany, count } }),
}));

const { default: NewsPage, generateMetadata } = await import('./page.js');

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewsPage', () => {
  it('renders the published post cards with title, category, author and date', async () => {
    findMany.mockResolvedValue([post]);
    count.mockResolvedValue(1);

    render(await NewsPage({ searchParams: Promise.resolve({}) }));

    // The list read filters to published posts only (drafts never leak).
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
    expect(screen.getByRole('link', { name: 'The spring market in 2026' })).toHaveAttribute(
      'href',
      '/news/spring-market-2026',
    );
    expect(screen.getByText('Market insight')).toBeInTheDocument();
    expect(screen.getByText('Jo Bloggs')).toBeInTheDocument();
    expect(screen.getByText('1 March 2026')).toBeInTheDocument();
    expect(screen.getByText('1 article')).toBeInTheDocument();
  });

  it('passes the category filter from the query into the read model', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    render(await NewsPage({ searchParams: Promise.resolve({ category: 'market-insight' }) }));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', category: { slug: 'market-insight' } },
      }),
    );
    // A clear-filter link returns to the unfiltered index.
    expect(screen.getByRole('link', { name: 'Clear filter' })).toHaveAttribute('href', '/news');
  });

  it('renders the empty state when there are no articles', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    render(await NewsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('No articles')).toBeInTheDocument();
    expect(screen.getByText(/No articles to show just yet/i)).toBeInTheDocument();
  });

  it('renders pagination links across more than one page', async () => {
    findMany.mockResolvedValue([post]);
    count.mockResolvedValue(25);

    render(await NewsPage({ searchParams: Promise.resolve({ page: '2' }) }));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute('href', '/news');
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute('href', '/news?page=3');
  });

  it('emits a canonical, OG and Twitter metadata set (FR-O-4)', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Knowledge hub');
    expect(meta.alternates?.canonical).toBe('https://acme.test/news');
    expect(meta.openGraph?.url).toBe('https://acme.test/news');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});
