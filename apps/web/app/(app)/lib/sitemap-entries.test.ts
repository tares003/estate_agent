import { describe, expect, it } from 'vitest';
import {
  areaGuideSitemapEntries,
  blogPostSitemapEntries,
  pageSitemapEntries,
  propertySitemapEntries,
  sitemapIds,
  staticSitemapEntries,
  SITEMAP_CHILD_IDS,
  type SitemapAreaGuideEntry,
  type SitemapBlogPostEntry,
  type SitemapPageEntry,
  type SitemapPropertyEntry,
} from './sitemap-entries.js';

const ORIGIN = 'https://acme.test';

describe('sitemapIds (FR-O-8 index)', () => {
  it('lists the five child sitemap ids the index points at', () => {
    expect(sitemapIds()).toEqual([
      { id: 'static' },
      { id: 'properties' },
      { id: 'pages' },
      { id: 'blog' },
      { id: 'areas' },
    ]);
  });

  it('exposes the same ids as a flat tuple for the route to dispatch on', () => {
    expect(SITEMAP_CHILD_IDS).toEqual(['static', 'properties', 'pages', 'blog', 'areas']);
  });
});

describe('staticSitemapEntries', () => {
  const entries = staticSitemapEntries(ORIGIN);
  const urls = entries.map((e) => e.url);

  it('includes the home, catalogue and calculator landing routes', () => {
    expect(urls).toContain('https://acme.test/');
    expect(urls).toContain('https://acme.test/properties');
    expect(urls).toContain('https://acme.test/calculators');
    expect(urls).toContain('https://acme.test/calculators/mortgage');
    expect(urls).toContain('https://acme.test/calculators/stamp-duty');
  });

  it('includes the public conversion landing routes', () => {
    expect(urls).toContain('https://acme.test/valuation');
    expect(urls).toContain('https://acme.test/contact');
    expect(urls).toContain('https://acme.test/report-a-repair');
  });

  it('includes the knowledge-hub and area-guide index routes', () => {
    expect(urls).toContain('https://acme.test/news');
    expect(urls).toContain('https://acme.test/locations');
  });

  it('gives the home page top priority and the catalogue a high one', () => {
    expect(entries.find((e) => e.url === 'https://acme.test/')?.priority).toBe(1);
    expect(entries.find((e) => e.url === 'https://acme.test/properties')?.priority).toBe(0.9);
  });

  it('sets a sensible changeFrequency on the catalogue (hourly)', () => {
    expect(entries.find((e) => e.url === 'https://acme.test/properties')?.changeFrequency).toBe(
      'hourly',
    );
  });

  it('does not list noindex / token-gated surfaces', () => {
    expect(urls.some((u) => u.includes('/feedback'))).toBe(false);
    expect(urls.some((u) => u.includes('/repairs/contractor'))).toBe(false);
  });
});

describe('propertySitemapEntries', () => {
  const properties: SitemapPropertyEntry[] = [
    { slug: 'palatine-road-m20', updatedAt: new Date('2026-01-02') },
    { slug: 'school-lane-sk9', updatedAt: new Date('2026-03-04') },
  ];

  it('builds one daily, priority-0.8 entry per property with last-modified', () => {
    const entries = propertySitemapEntries(properties, ORIGIN);
    expect(entries).toEqual([
      {
        url: 'https://acme.test/properties/palatine-road-m20',
        lastModified: new Date('2026-01-02'),
        changeFrequency: 'daily',
        priority: 0.8,
      },
      {
        url: 'https://acme.test/properties/school-lane-sk9',
        lastModified: new Date('2026-03-04'),
        changeFrequency: 'daily',
        priority: 0.8,
      },
    ]);
  });

  it('returns an empty list for no properties', () => {
    expect(propertySitemapEntries([], ORIGIN)).toEqual([]);
  });
});

describe('pageSitemapEntries', () => {
  const pages: SitemapPageEntry[] = [
    { slug: 'about', updatedAt: new Date('2026-02-03') },
    { slug: 'selling/guide', updatedAt: new Date('2026-02-04') },
  ];

  it('builds one weekly, priority-0.6 entry per published page with last-modified', () => {
    const entries = pageSitemapEntries(pages, ORIGIN);
    expect(entries).toEqual([
      {
        url: 'https://acme.test/about',
        lastModified: new Date('2026-02-03'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
      {
        url: 'https://acme.test/selling/guide',
        lastModified: new Date('2026-02-04'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
    ]);
  });

  it('returns an empty list for no pages', () => {
    expect(pageSitemapEntries([], ORIGIN)).toEqual([]);
  });
});

describe('blogPostSitemapEntries', () => {
  const posts: SitemapBlogPostEntry[] = [
    { slug: 'first-time-buyer-guide', updatedAt: new Date('2026-04-05') },
    { slug: 'autumn-market-review', updatedAt: new Date('2026-05-06') },
  ];

  it('builds one weekly, priority-0.6 entry per published post under /news with last-modified', () => {
    const entries = blogPostSitemapEntries(posts, ORIGIN);
    expect(entries).toEqual([
      {
        url: 'https://acme.test/news/first-time-buyer-guide',
        lastModified: new Date('2026-04-05'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
      {
        url: 'https://acme.test/news/autumn-market-review',
        lastModified: new Date('2026-05-06'),
        changeFrequency: 'weekly',
        priority: 0.6,
      },
    ]);
  });

  it('returns an empty list for no posts', () => {
    expect(blogPostSitemapEntries([], ORIGIN)).toEqual([]);
  });
});

describe('areaGuideSitemapEntries', () => {
  const guides: SitemapAreaGuideEntry[] = [
    { slug: 'didsbury', updatedAt: new Date('2026-06-07') },
    { slug: 'chorlton', updatedAt: new Date('2026-06-08') },
  ];

  it('builds one weekly, priority-0.7 entry per published guide under /locations with last-modified', () => {
    const entries = areaGuideSitemapEntries(guides, ORIGIN);
    expect(entries).toEqual([
      {
        url: 'https://acme.test/locations/didsbury',
        lastModified: new Date('2026-06-07'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: 'https://acme.test/locations/chorlton',
        lastModified: new Date('2026-06-08'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
    ]);
  });

  it('returns an empty list for no guides', () => {
    expect(areaGuideSitemapEntries([], ORIGIN)).toEqual([]);
  });
});
