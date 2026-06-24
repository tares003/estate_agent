import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  propertyListingJsonLd,
  suggestImageAltText,
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

describe('suggestImageAltText (FR-O-13 / §O.8)', () => {
  it('follows the §O.8 pattern: "Photograph of [title], [location] — photo N"', () => {
    expect(
      suggestImageAltText({
        propertyTitle: 'Edwardian semi · 4 bed',
        addressLine: 'Palatine Road, Didsbury',
        index: 0,
      }),
    ).toBe('Photograph of Edwardian semi · 4 bed, Palatine Road, Didsbury — photo 1');
  });

  it('numbers photos from one, not zero (index is zero-based)', () => {
    expect(
      suggestImageAltText({
        propertyTitle: '3-bed terraced house',
        addressLine: 'Acacia Avenue',
        index: 1,
      }),
    ).toBe('Photograph of 3-bed terraced house, Acacia Avenue — photo 2');
  });

  it('collapses whitespace and trims the title and location', () => {
    expect(
      suggestImageAltText({
        propertyTitle: '  Studio   flat ',
        addressLine: ' Whitworth   St ',
        index: 4,
      }),
    ).toBe('Photograph of Studio flat, Whitworth St — photo 5');
  });

  it('omits the location segment when no address line is available', () => {
    expect(
      suggestImageAltText({ propertyTitle: 'Riverside apartment', addressLine: '', index: 0 }),
    ).toBe('Photograph of Riverside apartment — photo 1');
    expect(
      suggestImageAltText({ propertyTitle: 'Riverside apartment', addressLine: '   ', index: 0 }),
    ).toBe('Photograph of Riverside apartment — photo 1');
  });

  it('falls back to a generic noun when the title is blank', () => {
    expect(
      suggestImageAltText({ propertyTitle: '   ', addressLine: 'High Street', index: 0 }),
    ).toBe('Photograph of property, High Street — photo 1');
  });

  it('is non-empty for any input, so it always satisfies the mandatory-alt rule', () => {
    expect(
      suggestImageAltText({ propertyTitle: '', addressLine: '', index: 0 }).trim().length,
    ).toBeGreaterThan(0);
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
