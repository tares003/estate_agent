import { describe, expect, it, vi } from 'vitest';
import {
  getPropertyBySlug,
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
});
