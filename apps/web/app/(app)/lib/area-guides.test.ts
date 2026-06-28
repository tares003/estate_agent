// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  AREA_PROPERTY_LIMIT,
  getPublishedAreaGuideBySlug,
  listPropertiesForArea,
  listPublishedAreaGuides,
  type AreaGuideListReader,
  type AreaGuideReader,
  type AreaPropertyReader,
} from './area-guides.js';

// EPIC-C C.13 area-guide read model. Pure query-shaping over a STRUCTURAL Prisma
// client (DB-free to unit-test, mirrors saved-properties.ts); the live queries run
// tenant-scoped (RLS) via withTenant in the /locations/[slug] route. Published
// guides only; properties filtered by the guide's postcode prefixes.

const GUIDE = {
  id: 'g1',
  slug: 'didsbury',
  name: 'Didsbury',
  introduction: 'A leafy suburb in south Manchester.',
  heroImage: 'tenants/t1/area-guides/g1/hero.jpg',
  postcodePrefixes: ['M20', 'M21'],
  latitude: 53.41,
  longitude: -2.23,
  metaTitle: 'Living in Didsbury',
  metaDescription: 'Your guide to Didsbury.',
};

function guideReader(
  guide: typeof GUIDE | null,
  sections: Array<{ type: string; data: unknown }> = [],
): {
  r: AreaGuideReader;
  guideFindFirst: ReturnType<typeof vi.fn>;
  sectionFindMany: ReturnType<typeof vi.fn>;
} {
  const guideFindFirst = vi.fn(async () => guide);
  const sectionFindMany = vi.fn(async () => sections);
  return {
    r: {
      areaGuide: { findFirst: guideFindFirst },
      areaGuideSection: { findMany: sectionFindMany },
    } as unknown as AreaGuideReader,
    guideFindFirst,
    sectionFindMany,
  };
}

describe('getPublishedAreaGuideBySlug', () => {
  it('returns the published guide with its visible sections in sort order', async () => {
    const { r, guideFindFirst, sectionFindMany } = guideReader(GUIDE, [
      { type: 'rich_text', data: { html: '<p>About</p>' } },
      { type: 'faq', data: { items: [] } },
    ]);

    const result = await getPublishedAreaGuideBySlug(r, 'didsbury');

    expect(result).toMatchObject({
      id: 'g1',
      slug: 'didsbury',
      name: 'Didsbury',
      introduction: 'A leafy suburb in south Manchester.',
      heroImage: 'tenants/t1/area-guides/g1/hero.jpg',
      postcodePrefixes: ['M20', 'M21'],
      latitude: 53.41,
      longitude: -2.23,
      metaTitle: 'Living in Didsbury',
      metaDescription: 'Your guide to Didsbury.',
    });
    expect(result?.sections).toEqual([
      { type: 'rich_text', data: { html: '<p>About</p>' } },
      { type: 'faq', data: { items: [] } },
    ]);
    // only PUBLISHED guides are public
    expect(guideFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { slug: 'didsbury', status: 'published' },
    });
    // only visible sections, ordered by sortOrder
    expect(sectionFindMany.mock.calls[0]![0]).toMatchObject({
      where: { areaGuideId: 'g1', isVisible: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('returns null (and skips the section query) when no published guide exists', async () => {
    const { r, sectionFindMany } = guideReader(null);
    expect(await getPublishedAreaGuideBySlug(r, 'nope')).toBeNull();
    expect(sectionFindMany).not.toHaveBeenCalled();
  });

  it('returns an empty section list when the guide has no visible sections', async () => {
    const { r } = guideReader(GUIDE, []);
    const result = await getPublishedAreaGuideBySlug(r, 'didsbury');
    expect(result?.sections).toEqual([]);
  });
});

function listReader(guides: Array<Record<string, unknown>> = []): {
  r: AreaGuideListReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => guides);
  return {
    r: { areaGuide: { findMany } } as unknown as AreaGuideListReader,
    findMany,
  };
}

describe('listPublishedAreaGuides', () => {
  it('returns published guide cards alphabetically, drafts excluded', async () => {
    const { r, findMany } = listReader([
      {
        slug: 'chorlton',
        name: 'Chorlton',
        introduction: 'A bohemian quarter.',
        heroImage: 'tenants/t1/area-guides/g2/hero.jpg',
      },
      {
        slug: 'didsbury',
        name: 'Didsbury',
        introduction: 'A leafy suburb in south Manchester.',
        heroImage: null,
      },
    ]);

    const cards = await listPublishedAreaGuides(r);

    expect(cards).toEqual([
      {
        slug: 'chorlton',
        name: 'Chorlton',
        introduction: 'A bohemian quarter.',
        heroImage: 'tenants/t1/area-guides/g2/hero.jpg',
      },
      {
        slug: 'didsbury',
        name: 'Didsbury',
        introduction: 'A leafy suburb in south Manchester.',
        heroImage: null,
      },
    ]);
    // only PUBLISHED guides are public, ordered by name
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: { status: 'published' },
      orderBy: { name: 'asc' },
    });
  });

  it('returns an empty list when there are no published guides', async () => {
    const { r } = listReader([]);
    expect(await listPublishedAreaGuides(r)).toEqual([]);
  });
});

function propertyReader(properties: Array<{ id: string; slug: string }> = []): {
  r: AreaPropertyReader;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn(async () => properties);
  return {
    r: { property: { findMany } } as unknown as AreaPropertyReader,
    findMany,
  };
}

const PROPERTY = {
  id: 'p1',
  slug: 'palatine-road-m20',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20 2QR',
  title: 'Edwardian semi · 4 bed',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
};

describe('listPropertiesForArea', () => {
  it('matches each postcode prefix with startsWith, published + newest-first', async () => {
    const { r, findMany } = propertyReader([PROPERTY] as never);

    const items = await listPropertiesForArea(r, ['M20', 'M21']);

    expect(items.map((item) => item.id)).toEqual(['p1']);
    expect(items[0]).toMatchObject({ title: 'Edwardian semi · 4 bed', price: '£525,000' });
    expect(findMany.mock.calls[0]![0]).toMatchObject({
      where: {
        publishedAt: { not: null },
        deletedAt: null,
        OR: [{ postcode: { startsWith: 'M20' } }, { postcode: { startsWith: 'M21' } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: AREA_PROPERTY_LIMIT,
    });
  });

  it('honours a caller-supplied limit', async () => {
    const { r, findMany } = propertyReader([]);
    await listPropertiesForArea(r, ['M20'], 3);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ take: 3 });
  });

  it('returns an empty list (and runs no query) when there are no prefixes', async () => {
    const { r, findMany } = propertyReader([]);
    expect(await listPropertiesForArea(r, [])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
