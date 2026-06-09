import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('./lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ property: { findMany } }),
}));

const listPublishedPages = vi.fn();
vi.mock('./lib/cms.js', () => ({
  listPublishedPages: (...args: unknown[]) => listPublishedPages(...args),
}));

const { default: sitemap } = await import('./sitemap.js');

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  listPublishedPages.mockResolvedValue([]);
});

describe('sitemap', () => {
  it('lists the static routes plus published properties with last-modified', async () => {
    findMany.mockResolvedValue([{ slug: 'palatine-road-m20', updatedAt: new Date('2026-01-02') }]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/');
    expect(urls).toContain('https://acme.test/properties');
    expect(urls).toContain('https://acme.test/properties/palatine-road-m20');

    const property = entries.find((e) => e.url.endsWith('palatine-road-m20'));
    expect(property?.lastModified).toEqual(new Date('2026-01-02'));
  });

  it('queries only published, non-deleted properties', async () => {
    findMany.mockResolvedValue([]);
    await sitemap();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publishedAt: { not: null }, deletedAt: null } }),
    );
  });

  it('lists published CMS pages for the tenant (FR-D-4)', async () => {
    listPublishedPages.mockResolvedValue([
      { slug: 'about', updatedAt: new Date('2026-02-03') },
      { slug: 'selling/guide', updatedAt: new Date('2026-02-04') },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://acme.test/about');
    expect(urls).toContain('https://acme.test/selling/guide');
    expect(entries.find((e) => e.url.endsWith('/about'))?.lastModified).toEqual(
      new Date('2026-02-03'),
    );
    // scoped to the resolved tenant
    expect(listPublishedPages).toHaveBeenCalledWith('tenant-1');
  });
});
