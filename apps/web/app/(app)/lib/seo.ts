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
 * `RealEstateListing` JSON-LD for a property (FR-O-5). Geo, offers and the
 * gallery `image` array are included only when their data is present; floor
 * size remains absent from the view model and is omitted rather than faked.
 *
 * `images` are the gallery photo URLs in display order (the caller resolves
 * them to absolute, render-time signed URLs). Schema.org accepts a URL array
 * for `image`; an empty/absent list omits the field.
 */
export function propertyListingJsonLd(
  property: PropertyForSeo,
  url: string,
  images: readonly string[] = [],
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
  if (images.length > 0) jsonLd['image'] = [...images];
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

/** The blog-post fields the `Article` structured data needs (a PublishedPost satisfies it). */
export interface BlogPostForSeo {
  /** The post headline (`BlogPost.title`). */
  title: string;
  /** A short summary for `description` (the post excerpt or meta description). */
  description: string | null;
  /** ISO publication date for `datePublished`; null until published. */
  publishedAt: Date | null;
  /** The by-line author name, or null when the post has no author. */
  authorName: string | null;
  /** An absolute hero-image URL for `image`, or null when the post has no hero. */
  imageUrl: string | null;
}

/**
 * `BlogPosting` JSON-LD for a knowledge-hub article (FR-O-7; master spec §O.3).
 * A `BlogPosting` is the `Article` subtype Google's Article rich result accepts.
 * Emits headline, the canonical URL (also `mainEntityOfPage`), datePublished,
 * author and image only when their data is present — absent fields are omitted
 * rather than faked. Pure + IO-free, so it unit-tests in isolation; the caller
 * resolves `url` / `imageUrl` to absolute, render-time URLs.
 */
export function blogPostingJsonLd(post: BlogPostForSeo, url: string): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  if (post.description) jsonLd['description'] = post.description;
  if (post.publishedAt) jsonLd['datePublished'] = post.publishedAt.toISOString();
  if (post.authorName) {
    jsonLd['author'] = { '@type': 'Person', name: post.authorName };
  }
  if (post.imageUrl) jsonLd['image'] = post.imageUrl;
  return jsonLd;
}

/** The inputs the alt-text suggester needs for one gallery photo. */
export interface ImageAltSuggestionInput {
  /** The listing title (`Property.title`), e.g. "3-bed terraced house". */
  propertyTitle: string;
  /** A location segment — the listing's `displayAddress` (or town). May be empty. */
  addressLine: string;
  /** Zero-based position of the photo in the gallery; rendered as "photo N+1". */
  index: number;
}

/** Collapse internal whitespace runs to single spaces and trim the ends. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Suggest alt text for a property photo (FR-O-13; master spec §O.8 discipline:
 * `"Photograph of [property title], [town] — [room or angle]"`). The room/angle
 * is unknown at upload time, so the photo number stands in. The result is always
 * non-empty (a blank title falls back to the generic noun "property"), so it can
 * pre-fill the mandatory alt field and satisfy the never-decorative-by-default
 * rule on its own. Pure + IO-free.
 */
export function suggestImageAltText(input: ImageAltSuggestionInput): string {
  const title = collapseWhitespace(input.propertyTitle) || 'property';
  const location = collapseWhitespace(input.addressLine);
  const subject = location ? `${title}, ${location}` : title;
  return `Photograph of ${subject} — photo ${input.index + 1}`;
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

/** Drop a single trailing slash so the origin is stable for `@id` / `url`. */
function normaliseOrigin(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

/** Stable `@id` for the agency entity so other JSON-LD nodes can reference it. */
function organisationId(origin: string): string {
  return `${normaliseOrigin(origin)}/#organisation`;
}

/**
 * Site-wide `RealEstateAgent` (an `Organization`) JSON-LD (FR-O-7, master spec
 * §O.3). Built from what the platform-tenant record exposes today — the agency
 * `name` and the request origin. Richer fields (logo, telephone, address, geo,
 * `sameAs`, `aggregateRating`, opening hours) are omitted rather than faked, to
 * be added once a tenant-settings read model carries them.
 */
export function organizationJsonLd(name: string, origin: string): Record<string, unknown> {
  const url = normaliseOrigin(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': organisationId(origin),
    name,
    url,
  };
}

/**
 * Site-wide `WebSite` JSON-LD (FR-O-7, master spec §O.3) for the public site,
 * with its `publisher` linked to the `Organization` node by `@id`.
 */
export function webSiteJsonLd(name: string, origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: normaliseOrigin(origin),
    publisher: { '@id': organisationId(origin) },
  };
}
