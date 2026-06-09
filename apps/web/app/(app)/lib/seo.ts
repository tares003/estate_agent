// EPIC-O SEO emission helpers (master spec §O). Pure builders for the structured
// data (JSON-LD) and the metadata-string discipline — no React, no DB — so they
// unit-test in isolation and the routes stay thin.

/** Trim text to at most `max` characters on a word boundary, adding an ellipsis. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/** The property fields the structured data needs (a PropertyDetail satisfies it). */
export interface PropertyForSeo {
  title: string;
  description: string | null;
  displayAddress: string;
  town: string | null;
  postcode: string;
  bedrooms?: number;
  bathrooms?: number;
  latitude: number | null;
  longitude: number | null;
  /** Asking price in whole pounds (GBP), or null for POA. */
  priceValue: number | null;
  /** Market status (snake_case enum value) → drives offer availability. */
  marketStatus: string;
}

/** schema.org availability for a market status (master spec §J.3 lifecycle). */
function availabilityFor(marketStatus: string): string {
  switch (marketStatus) {
    case 'sold':
    case 'let':
      return 'https://schema.org/SoldOut';
    case 'under_offer':
    case 'sold_stc':
    case 'let_agreed':
      return 'https://schema.org/LimitedAvailability';
    default:
      return 'https://schema.org/InStock';
  }
}

/**
 * `RealEstateListing` JSON-LD for a property (FR-O-5). Fields absent from the
 * view model (image, floor size) are omitted rather than faked; geo and offers
 * are included only when their data is present.
 */
export function propertyListingJsonLd(
  property: PropertyForSeo,
  url: string,
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.displayAddress,
      ...(property.town ? { addressLocality: property.town } : {}),
      postalCode: property.postcode,
      addressCountry: 'GB',
    },
  };
  if (property.description) jsonLd['description'] = property.description;
  if (property.bedrooms != null) jsonLd['numberOfBedrooms'] = property.bedrooms;
  if (property.bathrooms != null) jsonLd['numberOfBathroomsTotal'] = property.bathrooms;
  if (property.latitude != null && property.longitude != null) {
    jsonLd['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: property.latitude,
      longitude: property.longitude,
    };
  }
  if (property.priceValue != null) {
    jsonLd['offers'] = {
      '@type': 'Offer',
      price: property.priceValue,
      priceCurrency: 'GBP',
      availability: availabilityFor(property.marketStatus),
    };
  }
  return jsonLd;
}

/** One breadcrumb (name + absolute URL). */
export interface Breadcrumb {
  name: string;
  url: string;
}

/** `BreadcrumbList` JSON-LD (FR-O-6) — ordered list of ancestors + the current page. */
export function breadcrumbJsonLd(crumbs: Breadcrumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}
