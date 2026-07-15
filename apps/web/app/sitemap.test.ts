import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-O sitemap (FR-O-8). `/sitemap.xml` is ONE flat sitemap (not split via
// generateSitemaps — see sitemap.ts for why the split left the advertised /sitemap.xml
// 404ing). These pin: the combined URL set across all sources, the published-only filters,
// and — the resilience that keeps a crawler from getting a 500 — graceful degradation when
// a source fails (no tenant → static only; DB down → static only; Payload dormant → every
// section except CMS pages).

const getCurrentTenantId = vi.fn();
vi.mock('./(app)/lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('./(app)/lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const blogFindMany = vi.fn();
const areaFindMany = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findMany },
    blogPost: { findMany: blogFindMany },
    areaGuide: { findMany: areaFindMany },
  }),
);
vi.mock('@estate/db', () => ({
  withTenant: (...a: unknown[]) => withTenant(...(a as [never, never, never])),
}));

const listPublishedPages = vi.fn();
vi.mock('./(app)/lib/cms.js', () => ({
  listPublishedPages: (...args: unknown[]) => listPublishedPages(...args),
}));

const { default: sitemap } = await import('./sitemap.js');
const urlsOf = async () => (await sitemap()).map((e) => e.url);

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks resets call history but NOT implementations, so restore withTenant's
  // default passthrough after any test that made it reject.
  withTenant.mockImplementation(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({
      property: { findMany },
      blogPost: { findMany: blogFindMany },
      areaGuide: { findMany: areaFindMany },
    }),
  );
  getCurrentTenantId.mockResolvedValue('tenant-1');
  findMany.mockResolvedValue([{ slug: 'palatine-road-m20', updatedAt: new Date('2026-01-02') }]);
  blogFindMany.mockResolvedValue([
    { slug: 'first-time-buyer-guide', updatedAt: new Date('2026-04-05') },
  ]);
  areaFindMany.mockResolvedValue([{ slug: 'didsbury', updatedAt: new Date('2026-06-07') }]);
  listPublishedPages.mockResolvedValue([{ slug: 'about', updatedAt: new Date('2026-02-03') }]);
});

describe('sitemap — a single served /sitemap.xml (FR-O-8)', () => {
  it('lists the public static routes', async () => {
    const urls = await urlsOf();
    expect(urls).toContain('https://acme.test/');
    expect(urls).toContain('https://acme.test/properties');
    expect(urls).toContain('https://acme.test/calculators');
    expect(urls).toContain('https://acme.test/news');
    expect(urls).toContain('https://acme.test/locations');
  });

  it('combines every source into one flat sitemap', async () => {
    const urls = await urlsOf();
    expect(urls).toContain('https://acme.test/properties/palatine-road-m20'); // property
    expect(urls).toContain('https://acme.test/news/first-time-buyer-guide'); // blog post
    expect(urls).toContain('https://acme.test/locations/didsbury'); // area guide
    expect(urls).toContain('https://acme.test/about'); // CMS page
    expect(listPublishedPages).toHaveBeenCalledWith('tenant-1');
  });

  it('carries last-modified through for crawler freshness', async () => {
    const entries = await sitemap();
    expect(entries.find((e) => e.url.endsWith('palatine-road-m20'))?.lastModified).toEqual(
      new Date('2026-01-02'),
    );
  });

  it('queries only published, non-deleted properties and published posts/guides (FR-D-4)', async () => {
    await sitemap();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishedAt: { not: null }, deletedAt: null } }),
    );
    expect(blogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
    expect(areaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'published' } }),
    );
  });
});

describe('sitemap — graceful degradation (a 500 sitemap is a hard crawler failure)', () => {
  it('serves the static routes only when no tenant resolves, without throwing', async () => {
    getCurrentTenantId.mockRejectedValue(new Error('No platform tenant resolved'));

    const urls = await urlsOf();
    expect(urls).toContain('https://acme.test/'); // static still present
    expect(urls).not.toContain('https://acme.test/properties/palatine-road-m20');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('serves the static routes only when the database is unavailable', async () => {
    withTenant.mockRejectedValue(new Error('too many clients'));

    const urls = await urlsOf();
    expect(urls).toContain('https://acme.test/');
    expect(urls).not.toContain('https://acme.test/properties/palatine-road-m20');
  });

  it('omits ONLY the CMS pages when Payload is unavailable (e.g. dormant in dev)', async () => {
    // The exact local-dev situation: Payload is off, but the DB-backed sections must
    // still appear and /sitemap.xml must still serve.
    listPublishedPages.mockRejectedValue(new Error('missing secret key'));

    const urls = await urlsOf();
    expect(urls).toContain('https://acme.test/'); // static
    expect(urls).toContain('https://acme.test/properties/palatine-road-m20'); // DB section survives
    expect(urls).toContain('https://acme.test/news/first-time-buyer-guide');
    expect(urls).not.toContain('https://acme.test/about'); // CMS page omitted
  });
});
