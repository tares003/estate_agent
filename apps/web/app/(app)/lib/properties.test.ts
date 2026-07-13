import { describe, expect, it, vi } from 'vitest';
import {
  getPropertyBySlug,
  listPropertiesForSitemap,
  propertyTypeLabel,
  searchProperties,
  searchPropertiesNear,
  toCardProps,
  type PropertyRawClient,
  type PropertyRow,
} from './properties.js';

const saleRow: PropertyRow = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'palatine-road-m20',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20',
  title: 'Edwardian semi · 4 bed',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
  town: 'Manchester',
  latitude: 53.41,
  longitude: -2.23,
  // §F property-type category is nullable; a row without one must render a card with no
  // property-type meta (the default fixture pins that fail-soft path).
  category: null,
};

const rentRow: PropertyRow = {
  id: '22222222-2222-2222-2222-222222222222',
  slug: 'ellesmere-street-m15',
  displayAddress: 'Ellesmere Street, Castlefield',
  postcode: 'M15',
  title: null,
  saleType: 'rent',
  marketStatus: 'to_let',
  price: 145_000,
  bedrooms: 2,
  bathrooms: 1,
  receptions: null,
};

// §F.5 — a confidential business transfer: the title carries the business name and
// the display address is the exact trading address; neither may reach the public
// surface (master spec line 527, audit confidential-business-listing-leaks-name-address-geo).
const confidentialTransferRow: PropertyRow = {
  id: '33333333-3333-3333-3333-333333333333',
  slug: 'business-for-sale-manchester-m2',
  displayAddress: '12 King Street',
  postcode: 'M2 4WU',
  title: 'Bianchi & Sons Bakery',
  saleType: 'sale',
  marketStatus: 'for_sale',
  price: 25_000_000,
  bedrooms: null,
  bathrooms: null,
  receptions: null,
  town: 'Manchester',
  latitude: 53.48,
  longitude: -2.24,
  listingType: 'business_transfer',
  isConfidential: true,
};

describe('toCardProps', () => {
  it('maps a sale row to PropertyCard props with a guide price and no frequency', () => {
    const card = toCardProps(saleRow);
    expect(card).toMatchObject({
      href: '/properties/palatine-road-m20',
      status: 'for_sale',
      priceQualifier: 'Guide price',
      price: '£525,000',
      title: 'Edwardian semi · 4 bed',
      address: 'Palatine Road, Didsbury, M20',
      bedrooms: 4,
      bathrooms: 2,
    });
    expect(card.rentFrequency).toBeUndefined();
  });

  it('maps a rental row with a PCM frequency and falls back to the address for a missing title', () => {
    const card = toCardProps(rentRow);
    expect(card.status).toBe('to_rent');
    expect(card.priceQualifier).toBe('Asking rent');
    expect(card.rentFrequency).toBe('PCM');
    expect(card.title).toBe('Ellesmere Street, Castlefield');
  });

  it('renders a null-price (POA) row without a numeric price', () => {
    const card = toCardProps({ ...saleRow, price: null });
    expect(card.price).toBe('POA');
  });

  it('surfaces the property type on the card from the §F category (design-brief meta row)', () => {
    const card = toCardProps({ ...saleRow, category: 'house' });
    expect(card.propertyType).toBe('House');
  });

  it('omits the property type when the §F category is absent', () => {
    const card = toCardProps({ ...saleRow, category: null });
    expect(card.propertyType).toBeUndefined();
    const noCategory = toCardProps(saleRow);
    expect(noCategory.propertyType).toBeUndefined();
  });
});

describe('toCardProps — public address redaction (§F.5 confidential / hide exact address)', () => {
  it('redacts the business name and exact address for a confidential business transfer', () => {
    const card = toCardProps(confidentialTransferRow);
    // Non-identifying placeholder: town + postcode prefix only.
    expect(card.title).toBe('Manchester, M2');
    expect(card.address).toBe('Manchester, M2');
    expect(card.title).not.toContain('Bianchi');
    expect(card.address).not.toContain('King Street');
    expect(card.address).not.toContain('4WU');
  });

  it('keeps the name and address for a NON-confidential business transfer', () => {
    const card = toCardProps({ ...confidentialTransferRow, isConfidential: false });
    expect(card.title).toBe('Bianchi & Sons Bakery');
    expect(card.address).toBe('12 King Street, M2 4WU');
  });

  it('fails closed: a confidential flag on any row redacts, whatever the listing type', () => {
    // Vertical-field isolation should make this unreachable; if a stray flag ever
    // gets through, the safer wrong is to redact.
    const card = toCardProps({ ...saleRow, isConfidential: true });
    expect(card.address).toBe('Manchester, M20');
    expect(card.address).not.toContain('Palatine Road');
  });

  it('renders town + postcode prefix only when hideExactAddress is set (spec §J location)', () => {
    const card = toCardProps({ ...saleRow, postcode: 'M20 2QR', hideExactAddress: true });
    expect(card.address).toBe('Manchester, M20');
    expect(card.address).not.toContain('Palatine Road');
    expect(card.address).not.toContain('2QR');
    // The authored headline is not identifying — it stays.
    expect(card.title).toBe('Edwardian semi · 4 bed');
  });

  it('falls back to the redacted line — never the display address — for an untitled hidden-address row', () => {
    const card = toCardProps({ ...rentRow, town: 'Manchester', hideExactAddress: true });
    expect(card.title).toBe('Manchester, M15');
    expect(card.title).not.toContain('Ellesmere Street');
  });

  it('prefers the stored postcodePrefix and omits the town segment when the row has no town', () => {
    const card = toCardProps({
      ...saleRow,
      town: null,
      postcode: 'M20 2QR',
      postcodePrefix: 'M20',
      hideExactAddress: true,
    });
    expect(card.address).toBe('M20');
  });
});

describe('propertyTypeLabel', () => {
  it.each<[string, string]>([
    ['house', 'House'],
    ['flat', 'Flat'],
    ['bungalow', 'Bungalow'],
    ['studio', 'Studio'],
    ['maisonette', 'Maisonette'],
    ['commercial', 'Commercial'],
    ['land', 'Land'],
    ['room', 'Room'],
    ['retail', 'Retail'],
    ['office', 'Office'],
    ['industrial', 'Industrial'],
    ['leisure', 'Leisure'],
    ['business', 'Business'],
    ['care_home', 'Care home'],
    ['hmo', 'HMO'],
    ['mixed_use', 'Mixed use'],
  ])('maps the §F PropertyCategory %s to the display label %s', (category, label) => {
    expect(propertyTypeLabel(category)).toBe(label);
  });

  it('returns undefined for an absent or unknown category (fails soft)', () => {
    expect(propertyTypeLabel(null)).toBeUndefined();
    expect(propertyTypeLabel(undefined)).toBeUndefined();
    expect(propertyTypeLabel('not_a_category')).toBeUndefined();
  });
});

describe('searchProperties', () => {
  function reader(rows: PropertyRow[], total = rows.length) {
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(total);
    return { db: { property: { findMany, count } }, findMany, count };
  }

  const BASE_WHERE = { publishedAt: { not: null }, deletedAt: null };

  it('queries published, non-deleted properties newest-first, page 1, default page size', async () => {
    const { db, findMany, count } = reader([saleRow, rentRow], 2);
    const result = await searchProperties(db);
    expect(findMany).toHaveBeenCalledWith({
      where: BASE_WHERE,
      orderBy: { publishedAt: 'desc' },
      skip: 0,
      take: 24,
    });
    expect(count).toHaveBeenCalledWith({ where: BASE_WHERE });
    expect(result.items).toHaveLength(2);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 24, totalPages: 1 });
    expect(result.items[0]?.href).toBe('/properties/palatine-road-m20');
    // the hero-image join needs the property id alongside the card props
    expect(result.items[0]?.id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('hydrates the property type on each card from the row category', async () => {
    const { db } = reader([{ ...saleRow, category: 'house' }], 1);
    const result = await searchProperties(db);
    expect(result.items[0]?.propertyType).toBe('House');
  });

  it('leaves the property type off a card whose row has no §F category', async () => {
    const { db } = reader([{ ...saleRow, category: null }], 1);
    const result = await searchProperties(db);
    expect(result.items[0]?.propertyType).toBeUndefined();
  });

  it('composes every filter into the where clause', async () => {
    const { db, findMany } = reader([]);
    await searchProperties(db, {
      saleType: 'rent',
      listingType: 'residential',
      priceMin: 100_000,
      priceMax: 500_000,
      bedroomsMin: 2,
      bathroomsMin: 1,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...BASE_WHERE,
          saleType: 'rent',
          listingType: 'residential',
          price: { gte: 100_000, lte: 500_000 },
          bedrooms: { gte: 2 },
          bathrooms: { gte: 1 },
        },
      }),
    );
  });

  it('applies the §C.10 advanced filters — New Homes Only + added-within cutoff', async () => {
    const { db, findMany } = reader([]);
    const cutoff = new Date('2026-07-02T12:00:00Z');
    await searchProperties(db, { newHomesOnly: true, addedAfter: cutoff });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          // the added-within cutoff narrows the base published gate, never widens it
          publishedAt: { not: null, gte: cutoff },
          isNewHome: true,
        },
      }),
    );
  });

  it('leaves the advanced filters off the where clause when unset', async () => {
    const { db, findMany } = reader([]);
    await searchProperties(db, {});
    const where = findMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where['isNewHome']).toBeUndefined();
    expect(where['publishedAt']).toEqual({ not: null });
  });

  it('matches a location against the town (insensitive) OR a postcode prefix', async () => {
    const { db, findMany } = reader([]);
    await searchProperties(db, { location: 'Didsbury' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...BASE_WHERE,
          OR: [
            { town: { contains: 'Didsbury', mode: 'insensitive' } },
            { postcode: { startsWith: 'DIDSBURY' } },
          ],
        },
      }),
    );
  });

  it('only adds a price clause for the bounds provided', async () => {
    const { db, findMany } = reader([]);
    await searchProperties(db, { priceMax: 300_000 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ...BASE_WHERE, price: { lte: 300_000 } } }),
    );
  });

  it('maps each sort option to the right orderBy (price sorts pin POA/null last)', async () => {
    const { db, findMany } = reader([]);
    await searchProperties(db, { sort: 'price_asc' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: { sort: 'asc', nulls: 'last' } } }),
    );
    await searchProperties(db, { sort: 'price_desc' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: { sort: 'desc', nulls: 'last' } } }),
    );
    await searchProperties(db, { sort: 'oldest' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: 'asc' } }),
    );
  });

  it('paginates with skip/take and computes totalPages', async () => {
    const { db, findMany } = reader([saleRow], 50);
    const result = await searchProperties(db, { page: 3, pageSize: 10 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    expect(result).toMatchObject({ total: 50, page: 3, pageSize: 10, totalPages: 5 });
  });

  it('clamps page size to 60 and floors page to 1', async () => {
    const { db, findMany } = reader([], 0);
    const result = await searchProperties(db, { page: 0, pageSize: 1000 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 60 }));
    expect(result).toMatchObject({ page: 1, pageSize: 60, totalPages: 1 });
  });
});

describe('searchPropertiesNear', () => {
  function rawClient(rows: PropertyRow[], total = rows.length) {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const $queryRawUnsafe = vi.fn(async (sql: string, ...values: unknown[]) => {
      calls.push({ sql, values });
      return sql.includes('count(*)') ? [{ count: total }] : rows;
    });
    return { client: { $queryRawUnsafe } as unknown as PropertyRawClient, calls };
  }

  it('builds a parameterised ST_DWithin radius query ordered nearest-first', async () => {
    const { client, calls } = rawClient([saleRow], 1);
    const result = await searchPropertiesNear(client, {
      lat: 51.5,
      lng: -0.12,
      radiusMetres: 8047,
    });

    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 24, totalPages: 1 });
    expect(result.items[0]?.href).toBe('/properties/palatine-road-m20');

    const rowsCall = calls.find((c) => c.sql.includes('ORDER BY'));
    expect(rowsCall?.sql).toContain('ST_DWithin');
    expect(rowsCall?.sql).toContain('geog <-> ');
    // lng, lat, radiusMetres are the first three bound params; limit/offset follow.
    expect(rowsCall?.values.slice(0, 3)).toEqual([-0.12, 51.5, 8047]);
    expect(rowsCall?.values).toContain(24); // LIMIT (default page size)
    expect(rowsCall?.values).toContain(0); // OFFSET (page 1)
  });

  it('appends the §C.10 advanced-filter conditions to the radius query', async () => {
    const { client, calls } = rawClient([], 0);
    const cutoff = new Date('2026-07-02T12:00:00Z');
    await searchPropertiesNear(client, {
      lat: 51.5,
      lng: -0.12,
      radiusMetres: 8047,
      newHomesOnly: true,
      addedAfter: cutoff,
    });
    const rowsCall = calls.find((c) => c.sql.includes('ORDER BY'));
    expect(rowsCall?.sql).toContain('is_new_home = TRUE');
    expect(rowsCall?.sql).toContain('published_at >= ');
    expect(rowsCall?.values).toContainEqual(cutoff);
  });

  it('appends the filter conditions and runs a distinct count query', async () => {
    const { client, calls } = rawClient([], 0);
    await searchPropertiesNear(client, {
      lat: 51,
      lng: 0,
      radiusMetres: 5000,
      saleType: 'rent',
      priceMax: 50_000_000,
      bedroomsMin: 2,
      location: 'M20',
      page: 3,
      pageSize: 10,
    });

    const rowsCall = calls.find((c) => c.sql.includes('ORDER BY'));
    expect(rowsCall?.sql).toMatch(/sale_type = \$\d+::sale_type/);
    expect(rowsCall?.sql).toMatch(/price <= \$\d+/);
    expect(rowsCall?.sql).toMatch(/bedrooms >= \$\d+/);
    expect(rowsCall?.sql).toMatch(/town ILIKE \$\d+ OR postcode LIKE \$\d+/);
    expect(rowsCall?.values).toContain('rent');
    expect(rowsCall?.values).toContain('%M20%');
    expect(rowsCall?.values).toContain('M20%');
    expect(rowsCall?.values).toContain(10); // LIMIT (page size)
    expect(rowsCall?.values).toContain(20); // OFFSET (page 3 × size 10)

    const countCall = calls.find((c) => c.sql.includes('count(*)'));
    expect(countCall?.sql).not.toContain('ORDER BY');
    expect(countCall?.sql).not.toContain('LIMIT');
    // count reuses the WHERE params but omits limit/offset.
    expect(countCall?.values).not.toContain(10);
    expect(countCall?.values).not.toContain(20);
  });

  it('selects the redaction columns so radius results inherit the address masking', async () => {
    const { client, calls } = rawClient([confidentialTransferRow], 1);
    const result = await searchPropertiesNear(client, {
      lat: 53.48,
      lng: -2.24,
      radiusMetres: 500,
    });

    // The raw projection must carry the columns toCardProps redacts on, or a
    // confidential/hidden-address row found by radius search would leak.
    const rowsCall = calls.find((c) => c.sql.includes('ORDER BY'));
    expect(rowsCall?.sql).toContain('town');
    expect(rowsCall?.sql).toContain('postcode_prefix AS "postcodePrefix"');
    expect(rowsCall?.sql).toContain('listing_type::text AS "listingType"');
    expect(rowsCall?.sql).toContain('is_confidential AS "isConfidential"');
    expect(rowsCall?.sql).toContain('hide_exact_address AS "hideExactAddress"');

    expect(result.items[0]?.title).toBe('Manchester, M2');
    expect(result.items[0]?.address).toBe('Manchester, M2');
  });
});

describe('getPropertyBySlug', () => {
  it('fetches a single published, non-deleted property by slug and maps it to a detail', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ ...saleRow, description: 'A fine Edwardian semi.' });
    const detail = await getPropertyBySlug({ property: { findFirst } }, 'palatine-road-m20');
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'palatine-road-m20', publishedAt: { not: null }, deletedAt: null },
    });
    expect(detail).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'palatine-road-m20',
      href: '/properties/palatine-road-m20',
      price: '£525,000',
      description: 'A fine Edwardian semi.',
      receptions: 2,
      // SEO raw fields
      displayAddress: 'Palatine Road, Didsbury',
      town: 'Manchester',
      postcode: 'M20',
      latitude: 53.41,
      longitude: -2.23,
      priceValue: 525000, // 52,500,000 pence → £525,000
      marketStatus: 'for_sale',
    });
  });

  it('coerces a missing description to null and preserves the card mapping', async () => {
    const findFirst = vi.fn().mockResolvedValue(rentRow);
    const detail = await getPropertyBySlug({ property: { findFirst } }, 'ellesmere-street-m15');
    expect(detail?.description).toBeNull();
    expect(detail?.rentFrequency).toBe('PCM');
    expect(detail?.receptions).toBeNull();
  });

  it('returns null when no published property matches the slug', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    expect(await getPropertyBySlug({ property: { findFirst } }, 'does-not-exist')).toBeNull();
  });

  it('marks an unredacted detail addressRedacted=false', async () => {
    const findFirst = vi.fn().mockResolvedValue(saleRow);
    const detail = await getPropertyBySlug({ property: { findFirst } }, 'palatine-road-m20');
    expect(detail?.addressRedacted).toBe(false);
  });

  it('redacts every SEO-facing field for a confidential business transfer', async () => {
    const findFirst = vi.fn().mockResolvedValue(confidentialTransferRow);
    const detail = await getPropertyBySlug(
      { property: { findFirst } },
      'business-for-sale-manchester-m2',
    );
    expect(detail).toMatchObject({
      addressRedacted: true,
      title: 'Manchester, M2',
      address: 'Manchester, M2',
      // The raw SEO fields are coarsened at the data layer so every consumer inherits it.
      displayAddress: 'Manchester, M2',
      postcode: 'M2',
      latitude: null,
      longitude: null,
    });
  });

  it('coarsens the detail address and drops the coordinates when hideExactAddress is set', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ ...saleRow, postcode: 'M20 2QR', hideExactAddress: true });
    const detail = await getPropertyBySlug({ property: { findFirst } }, 'palatine-road-m20');
    expect(detail).toMatchObject({
      addressRedacted: true,
      title: 'Edwardian semi · 4 bed',
      address: 'Manchester, M20',
      displayAddress: 'Manchester, M20',
      postcode: 'M20',
      latitude: null,
      longitude: null,
    });
  });
});

describe('listPropertiesForSitemap', () => {
  it('selects published, non-deleted slugs + last-modified, newest-modified first', async () => {
    const rows = [{ slug: 'a', updatedAt: new Date('2026-01-02') }];
    const findMany = vi.fn().mockResolvedValue(rows);
    const result = await listPropertiesForSitemap({ property: { findMany } });
    expect(findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null }, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, updatedAt: true },
    });
    expect(result).toEqual(rows);
  });
});
