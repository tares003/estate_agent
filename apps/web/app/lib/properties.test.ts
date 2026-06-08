import { describe, expect, it, vi } from 'vitest';
import { listProperties, toCardProps, type PropertyRow } from './properties.js';

const saleRow: PropertyRow = {
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
});

describe('listProperties', () => {
  it('queries published, non-deleted properties newest-first and maps them to cards', async () => {
    const findMany = vi.fn().mockResolvedValue([saleRow, rentRow]);
    const cards = await listProperties({ property: { findMany } });
    expect(findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null }, deletedAt: null },
      orderBy: { publishedAt: 'desc' },
      take: 24,
    });
    expect(cards).toHaveLength(2);
    expect(cards[0]?.href).toBe('/properties/palatine-road-m20');
  });

  it('applies the saleType filter and take override', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await listProperties({ property: { findMany } }, { saleType: 'rent', take: 6 });
    expect(findMany).toHaveBeenCalledWith({
      where: { publishedAt: { not: null }, deletedAt: null, saleType: 'rent' },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    });
  });
});
