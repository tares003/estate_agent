import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  propertyListingJsonLd,
  truncate,
  webSiteJsonLd,
  type PropertyForSeo,
} from './seo.js';

const base: PropertyForSeo = {
  title: 'Edwardian semi · 4 bed',
  description: 'A handsome Edwardian semi in the village.',
  displayAddress: 'Palatine Road, Didsbury',
  town: 'Manchester',
  postcode: 'M20 2QR',
  bedrooms: 4,
  bathrooms: 2,
  latitude: 53.41,
  longitude: -2.23,
  priceValue: 525000,
  marketStatus: 'for_sale',
};

describe('truncate', () => {
  it('returns short text unchanged and collapses whitespace', () => {
    expect(truncate('Hello   world', 60)).toBe('Hello world');
  });

  it('truncates long text on a word boundary with an ellipsis (within max)', () => {
    const out = truncate('a'.repeat(10) + ' ' + 'b'.repeat(80), 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('propertyListingJsonLd', () => {
  it('emits a RealEstateListing with address, geo, beds/baths and an offer', () => {
    const ld = propertyListingJsonLd(base, 'https://acme.test/properties/palatine-road-m20');
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: 'Edwardian semi · 4 bed',
      url: 'https://acme.test/properties/palatine-road-m20',
      description: 'A handsome Edwardian semi in the village.',
      numberOfBedrooms: 4,
      numberOfBathroomsTotal: 2,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Palatine Road, Didsbury',
        addressLocality: 'Manchester',
        postalCode: 'M20 2QR',
        addressCountry: 'GB',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 53.41, longitude: -2.23 },
      offers: {
        '@type': 'Offer',
        price: 525000,
        priceCurrency: 'GBP',
        availability: 'https://schema.org/InStock',
      },
    });
  });

  it('omits geo, offer, description and beds/baths when the data is absent', () => {
    const ld = propertyListingJsonLd(
      {
        title: 'Studio',
        description: null,
        displayAddress: 'Whitworth St',
        town: null,
        postcode: 'M1 3AB',
        latitude: null,
        longitude: null,
        priceValue: null,
        marketStatus: 'to_let',
      },
      'https://acme.test/properties/studio-m1',
    );
    expect(ld['geo']).toBeUndefined();
    expect(ld['offers']).toBeUndefined();
    expect(ld['description']).toBeUndefined();
    expect(ld['numberOfBedrooms']).toBeUndefined();
    expect((ld['address'] as Record<string, unknown>)['addressLocality']).toBeUndefined();
  });

  it('reflects market status in offer availability', () => {
    const sold = propertyListingJsonLd({ ...base, marketStatus: 'sold' }, 'https://x.test/p');
    expect((sold['offers'] as Record<string, unknown>)['availability']).toBe(
      'https://schema.org/SoldOut',
    );
    const stc = propertyListingJsonLd({ ...base, marketStatus: 'sold_stc' }, 'https://x.test/p');
    expect((stc['offers'] as Record<string, unknown>)['availability']).toBe(
      'https://schema.org/LimitedAvailability',
    );
  });
});

describe('organizationJsonLd', () => {
  it('emits a RealEstateAgent (Organization) with the agency name and origin url', () => {
    const ld = organizationJsonLd('Acme Estates', 'https://acme.test');
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: 'Acme Estates',
      url: 'https://acme.test',
    });
  });

  it('uses an @id anchored to the origin so other entities can reference it', () => {
    const ld = organizationJsonLd('Acme Estates', 'https://acme.test');
    expect(ld['@id']).toBe('https://acme.test/#organisation');
  });

  it('does not leak a trailing slash from an origin that has one', () => {
    const ld = organizationJsonLd('Acme Estates', 'https://acme.test/');
    expect(ld['url']).toBe('https://acme.test');
    expect(ld['@id']).toBe('https://acme.test/#organisation');
  });
});

describe('webSiteJsonLd', () => {
  it('emits a WebSite naming the site and pointing at the origin', () => {
    const ld = webSiteJsonLd('Acme Estates', 'https://acme.test');
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Acme Estates',
      url: 'https://acme.test',
    });
  });

  it('links the WebSite publisher back to the Organization @id', () => {
    const ld = webSiteJsonLd('Acme Estates', 'https://acme.test/');
    expect(ld['url']).toBe('https://acme.test');
    expect(ld['publisher']).toMatchObject({ '@id': 'https://acme.test/#organisation' });
  });
});

describe('breadcrumbJsonLd', () => {
  it('emits an ordered BreadcrumbList', () => {
    const ld = breadcrumbJsonLd([
      { name: 'Home', url: 'https://acme.test/' },
      { name: 'Properties', url: 'https://acme.test/properties' },
      { name: 'Palatine Road', url: 'https://acme.test/properties/palatine-road-m20' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    const items = ld['itemListElement'] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ position: 1, name: 'Home', item: 'https://acme.test/' });
    expect(items[2]).toMatchObject({ position: 3, name: 'Palatine Road' });
  });
});
