// responsive-coverage: opt-out all — this asserts only the CMS page's SEO
// metadata resolution (the default override applied over the page defaults); the
// page render itself is exercised via runtime smoke / e2e (getPublishedPage
// constructs the Payload Local API, which is not unit-testable here).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/tenant.js', () => ({
  getCurrentTenantId: async () => 'tenant-1',
  getRequestOrigin: async () => 'https://acme.test',
}));
vi.mock('../lib/db.js', () => ({ getDb: () => ({}) }));

const getPublishedPage = vi.fn();
vi.mock('../lib/cms.js', () => ({ getPublishedPage }));

const seoFindFirst = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ seoMetadata: { findFirst: seoFindFirst } }),
}));

// The page component pulls the shared block renderer; stub it so the module loads.
vi.mock('../../../components/blocks/PageRenderer.js', () => ({
  PageRenderer: () => null,
}));

const { generateMetadata } = await import('./page.js');

const PAGE = { title: 'About us', slug: 'about', sections: [] };

function params(slug: string[]) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  seoFindFirst.mockResolvedValue(null);
  getPublishedPage.mockResolvedValue(PAGE);
});

describe('CmsPage generateMetadata', () => {
  it('builds the default metadata from the page title + its canonical URL (FR-O-4)', async () => {
    const meta = await generateMetadata(params(['about']));
    expect(meta.title).toBe('About us');
    expect(meta.alternates?.canonical).toBe('https://acme.test/about');
    expect(meta.openGraph?.url).toBe('https://acme.test/about');
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('applies the tenant-wide default SEO override over the page defaults', async () => {
    seoFindFirst.mockResolvedValue({
      id: 's1',
      scope: 'default',
      scopeId: null,
      metaTitle: null,
      metaDescription: 'Site-wide description.',
      canonicalUrl: null,
      ogImage: 'https://acme.test/social/default.jpg',
      noIndex: false,
      noFollow: false,
      structuredData: null,
    });

    const meta = await generateMetadata(params(['about']));

    // The CMS page resolves the tenant-wide default only (Payload page ids are not
    // the UUID the per-entity page scope requires).
    expect(seoFindFirst).toHaveBeenCalledWith({ where: { scope: 'default', scopeId: null } });
    // metaTitle unset → the page title is preserved; description + OG image win.
    expect(meta.title).toBe('About us');
    expect(meta.description).toBe('Site-wide description.');
    expect((meta.openGraph as { images?: unknown[] }).images).toEqual([
      'https://acme.test/social/default.jpg',
    ]);
    // No robots flags set → no robots meta (preserves default behaviour).
    expect(meta.robots).toBeUndefined();
  });

  it('returns a not-found title when the path resolves to no published page', async () => {
    getPublishedPage.mockResolvedValue(null);
    const meta = await generateMetadata(params(['ghost']));
    expect(meta.title).toBe('Page not found');
    expect(seoFindFirst).not.toHaveBeenCalled();
  });
});
