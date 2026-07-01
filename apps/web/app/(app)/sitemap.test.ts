import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('./lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const blogFindMany = vi.fn();
const areaFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findMany },
      blogPost: { findMany: blogFindMany },
      areaGuide: { findMany: areaFindMany },
    }),
}));

const listPublishedPages = vi.fn();
vi.mock('./lib/cms.js', () => ({
  listPublishedPages: (...args: unknown[]) => listPublishedPages(...args),
}));

const { default: sitemap, generateSitemaps } = await import('./sitemap.js');

/** Drive the default child-sitemap export with a given id (Next passes a promise). */
const child = (id: string) => sitemap({ id: Promise.resolve(id) });

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  blogFindMany.mockResolvedValue([]);
  areaFindMany.mockResolvedValue([]);
  listPublishedPages.mockResolvedValue([]);
});

describe('generateSitemaps (FR-O-8 sitemap index)', () => {
  it('declares the static, properties, pages, blog and areas child sitemaps', async () => {
    expect(await generateSitemaps()).toEqual([
      { id: 'static' },
      { id: 'properties' },
      { id: 'pages' },
      { id: 'blog' },
      { id: 'areas' },
    ]);
  });
});

describe('static child sitemap', () => {
  it('lists the public static routes (home, catalogue, calculators, hub indexes)', async () => {
    const entries = await child('static');
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/');
    expect(urls).toContain('https://acme.test/properties');
    expect(urls).toContain('https://acme.test/calculators');
    expect(urls).toContain('https://acme.test/news');
    expect(urls).toContain('https://acme.test/locations');
  });

  it('does not touch the property, page, blog or area data loaders', async () => {
    await child('static');
    expect(findMany).not.toHaveBeenCalled();
    expect(blogFindMany).not.toHaveBeenCalled();
    expect(areaFindMany).not.toHaveBeenCalled();
    expect(listPublishedPages).not.toHaveBeenCalled();
  });
});

describe('properties child sitemap', () => {
  it('lists published properties with last-modified', async () => {
    findMany.mockResolvedValue([{ slug: 'palatine-road-m20', updatedAt: new Date('2026-01-02') }]);

    const entries = await child('properties');
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/properties/palatine-road-m20');
    expect(entries.find((e) => e.url.endsWith('palatine-road-m20'))?.lastModified).toEqual(
      new Date('2026-01-02'),
    );
  });

  it('queries only published, non-deleted properties', async () => {
    await child('properties');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishedAt: { not: null }, deletedAt: null } }),
    );
  });
});

describe('pages child sitemap', () => {
  it('lists published CMS pages scoped to the resolved tenant (FR-D-4)', async () => {
    listPublishedPages.mockResolvedValue([
      { slug: 'about', updatedAt: new Date('2026-02-03') },
      { slug: 'selling/guide', updatedAt: new Date('2026-02-04') },
    ]);

    const entries = await child('pages');
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/about');
    expect(urls).toContain('https://acme.test/selling/guide');
    expect(entries.find((e) => e.url.endsWith('/about'))?.lastModified).toEqual(
      new Date('2026-02-03'),
    );
    expect(listPublishedPages).toHaveBeenCalledWith('tenant-1');
  });
});

describe('blog child sitemap', () => {
  it('lists published knowledge-hub posts under /news with last-modified', async () => {
    blogFindMany.mockResolvedValue([
      { slug: 'first-time-buyer-guide', updatedAt: new Date('2026-04-05') },
    ]);

    const entries = await child('blog');
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/news/first-time-buyer-guide');
    expect(entries.find((e) => e.url.endsWith('first-time-buyer-guide'))?.lastModified).toEqual(
      new Date('2026-04-05'),
    );
  });

  it('queries only published posts', async () => {
    await child('blog');
    expect(blogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
  });
});

describe('areas child sitemap', () => {
  it('lists published area guides under /locations with last-modified', async () => {
    areaFindMany.mockResolvedValue([{ slug: 'didsbury', updatedAt: new Date('2026-06-07') }]);

    const entries = await child('areas');
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/locations/didsbury');
    expect(entries.find((e) => e.url.endsWith('/didsbury'))?.lastModified).toEqual(
      new Date('2026-06-07'),
    );
  });

  it('queries only published guides', async () => {
    await child('areas');
    expect(areaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
  });
});

describe('unknown child id', () => {
  it('returns an empty sitemap rather than throwing', async () => {
    await expect(child('nope')).resolves.toEqual([]);
  });
});
