import type { PropertyCardProps } from '@estate/ui';
import { DEFAULT_PAGE_SIZE, type PropertySort } from '@estate/validators';
import { formatPrice, priceQualifier, rentFrequency, toCardStatus } from './format.js';

// EPIC-F property catalogue data layer. Pure mapping from §J Property rows to the
// PropertyCard view model — unit-tested with a fake client; the live queries run
// against tenant-scoped Postgres (RLS) via withTenant in the route. Keeping the
// client structural (not the full PrismaClient) keeps this testable without a DB.

/** The Property columns the catalogue reads. */
export interface PropertyRow {
  id: string;
  slug: string;
  displayAddress: string;
  postcode: string;
  title: string | null;
  saleType: string;
  marketStatus: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  receptions: number | null;
  description?: string | null;
}

export interface PropertyListReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }): Promise<PropertyRow[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

export interface PropertyDetailReader {
  property: {
    findFirst(args: { where?: Record<string, unknown> }): Promise<PropertyRow | null>;
  };
}

/** Property detail view model — card props plus the detail-only fields. */
export interface PropertyDetail extends PropertyCardProps {
  id: string;
  slug: string;
  description: string | null;
  receptions: number | null;
}

/** The catalogue filter / sort / pagination inputs (master spec §C.10 / §K.1). */
export interface PropertySearchOptions {
  location?: string;
  saleType?: 'sale' | 'rent';
  listingType?: string;
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  sort?: PropertySort;
  page?: number;
  pageSize?: number;
}

/** A page of catalogue results plus the totals the UI needs to paginate. */
export interface PropertySearchResult {
  items: PropertyCardProps[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Prisma `orderBy` for each "Order By" option (master spec feature #17).
 * Price can be null (POA — price on application), so both price sorts pin nulls
 * LAST via the Postgres `nulls` option — POA listings always fall to the end
 * rather than sorting unpredictably on the DB default. publishedAt is never null
 * here (the catalogue filters `publishedAt: { not: null }`).
 */
const SORT_ORDER: Record<PropertySort, Record<string, unknown>> = {
  newest: { publishedAt: 'desc' },
  oldest: { publishedAt: 'asc' },
  price_asc: { price: { sort: 'asc', nulls: 'last' } },
  price_desc: { price: { sort: 'desc', nulls: 'last' } },
};

/** Clamp `value` into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Build the Prisma `where` clause for the catalogue from the filter options. */
function buildWhere(options: PropertySearchOptions): Record<string, unknown> {
  // Base predicate: only published, non-soft-deleted properties are public.
  const where: Record<string, unknown> = { publishedAt: { not: null }, deletedAt: null };
  if (options.saleType) where['saleType'] = options.saleType;
  if (options.listingType) where['listingType'] = options.listingType;

  // Free-text location: match the town (case-insensitive substring) OR a postcode
  // prefix (e.g. "Didsbury" or "M20"). Geographic radius search (PostGIS) is a
  // later phase; this is the text-based location filter.
  if (options.location) {
    where['OR'] = [
      { town: { contains: options.location, mode: 'insensitive' } },
      { postcode: { startsWith: options.location.toUpperCase() } },
    ];
  }

  const price: Record<string, number> = {};
  if (options.priceMin != null) price['gte'] = options.priceMin;
  if (options.priceMax != null) price['lte'] = options.priceMax;
  if (Object.keys(price).length > 0) where['price'] = price;

  if (options.bedroomsMin != null) where['bedrooms'] = { gte: options.bedroomsMin };
  if (options.bathroomsMin != null) where['bathrooms'] = { gte: options.bathroomsMin };
  return where;
}

/** Map one §J Property row to PropertyCard props (trust markers applied). */
export function toCardProps(row: PropertyRow): PropertyCardProps {
  const card: PropertyCardProps = {
    href: `/properties/${row.slug}`,
    status: toCardStatus(row.marketStatus),
    priceQualifier: priceQualifier(row.marketStatus),
    price: formatPrice(row.price),
    title: row.title ?? row.displayAddress,
    address: `${row.displayAddress}, ${row.postcode}`,
  };
  const freq = rentFrequency(row.saleType);
  if (freq) card.rentFrequency = freq;
  if (row.bedrooms != null) card.bedrooms = row.bedrooms;
  if (row.bathrooms != null) card.bathrooms = row.bathrooms;
  return card;
}

/**
 * Search the catalogue: published, non-deleted properties matching the filters,
 * ordered by the chosen sort, one page at a time. Returns the mapped cards plus
 * the totals the UI paginates with. The query runs tenant-scoped (RLS) via
 * withTenant in the route; here the client is structural so it is DB-free to test.
 */
export async function searchProperties(
  db: PropertyListReader,
  options: PropertySearchOptions = {},
): Promise<PropertySearchResult> {
  const where = buildWhere(options);
  const orderBy = SORT_ORDER[options.sort ?? 'newest'];
  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    db.property.findMany({ where, orderBy, skip, take: pageSize }),
    db.property.count({ where }),
  ]);

  return {
    items: rows.map(toCardProps),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Fetch a single published property by slug (RLS scopes the query to the tenant). */
export async function getPropertyBySlug(
  db: PropertyDetailReader,
  slug: string,
): Promise<PropertyDetail | null> {
  const row = await db.property.findFirst({
    where: { slug, publishedAt: { not: null }, deletedAt: null },
  });
  if (!row) return null;
  return {
    ...toCardProps(row),
    id: row.id,
    slug: row.slug,
    description: row.description ?? null,
    receptions: row.receptions,
  };
}
