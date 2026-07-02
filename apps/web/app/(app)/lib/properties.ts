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
  town?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  // §F specification: the property category discriminator (PropertyCategory enum)
  // surfaced as the card's "property type" meta value; sub_category is the free-text
  // refinement kept for the detail surface.
  category?: string | null;
  subCategory?: string | null;
  // ── FR-F-3 per-vertical extension columns (§F.3–§F.6). Present on the detail read;
  //    the catalogue card ignores them. ─────────────────────────────────────────────
  listingType?: string | null;
  isOffPlan?: boolean | null;
  developmentName?: string | null;
  vatPayable?: boolean | null;
  annualBusinessRates?: number | null;
  useClass?: string | null;
  annualTurnover?: number | null;
  grossProfit?: number | null;
  netProfit?: number | null;
  yearsTrading?: number | null;
  staffCount?: number | null;
  currentAnnualRent?: number | null;
  isConfidential?: boolean | null;
  bedCount?: number | null;
  cqcRating?: string | null;
  cqcInspectionUrl?: string | null;
  isGoingConcern?: boolean | null;
}

/** The per-vertical extension facts surfaced on the public detail page (FR-F-3). */
export interface PropertyVerticalFacts {
  listingType: string;
  isOffPlan: boolean;
  developmentName: string | null;
  vatPayable: boolean | null;
  annualBusinessRates: number | null;
  useClass: string | null;
  annualTurnover: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  yearsTrading: number | null;
  staffCount: number | null;
  currentAnnualRent: number | null;
  isConfidential: boolean;
  bedCount: number | null;
  cqcRating: string | null;
  cqcInspectionUrl: string | null;
  isGoingConcern: boolean;
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

/**
 * Property detail view model — card props plus the detail-only fields and the
 * raw fields the SEO structured data needs (it satisfies seo.ts' PropertyForSeo).
 */
export interface PropertyDetail extends PropertyCardProps {
  id: string;
  slug: string;
  description: string | null;
  receptions: number | null;
  displayAddress: string;
  town: string | null;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  /** Asking price in whole pounds (GBP) for JSON-LD offers; null for POA. */
  priceValue: number | null;
  marketStatus: string;
  /** FR-F-3 — the per-vertical extension facts, discriminated by listingType. */
  vertical: PropertyVerticalFacts;
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

/** A catalogue entry: card props plus the id the hero-image join keys on. */
export type CatalogueItem = PropertyCardProps & { id: string };

/** A page of catalogue results plus the totals the UI needs to paginate. */
export interface PropertySearchResult {
  items: CatalogueItem[];
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

/**
 * §F `PropertyCategory` enum value → the human "property type" shown in the card
 * meta row (design-brief §F: "beds · baths · property type"). Mirrors the Prisma
 * `PropertyCategory` enum 1:1; an absent or unrecognised value yields no label so
 * the card simply omits the type rather than rendering a raw enum token.
 */
const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: 'House',
  flat: 'Flat',
  bungalow: 'Bungalow',
  studio: 'Studio',
  maisonette: 'Maisonette',
  commercial: 'Commercial',
  land: 'Land',
  room: 'Room',
  retail: 'Retail',
  office: 'Office',
  industrial: 'Industrial',
  leisure: 'Leisure',
  business: 'Business',
  care_home: 'Care home',
  hmo: 'HMO',
  mixed_use: 'Mixed use',
};

/** The display label for a §F property category, or undefined if absent/unknown (fails soft). */
export function propertyTypeLabel(category: string | null | undefined): string | undefined {
  if (category == null) return undefined;
  return PROPERTY_TYPE_LABELS[category];
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
  const type = propertyTypeLabel(row.category);
  if (type) card.propertyType = type;
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
    items: rows.map((row) => ({ id: row.id, ...toCardProps(row) })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Minimal raw-SQL surface for the PostGIS radius path. `ST_DWithin` / the `geog`
 * column can't be expressed through Prisma's query API, so the radius search runs
 * a parameterised raw query. The real Prisma tx (`$queryRawUnsafe`) satisfies this
 * in production; a thin `pg` adapter satisfies it in the integration test — so this
 * module stays DB-free and unit-testable with a fake.
 */
export interface PropertyRawClient {
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
}

/** Radius-search inputs: the core filters plus a centre point + radius in metres. */
export interface NearSearchOptions extends PropertySearchOptions {
  lat: number;
  lng: number;
  radiusMetres: number;
}

/** Columns the radius query selects, aliased to PropertyRow's camelCase shape. */
const RADIUS_SELECT =
  'id, slug, display_address AS "displayAddress", postcode, title, ' +
  'sale_type AS "saleType", market_status AS "marketStatus", price, bedrooms, bathrooms, receptions, ' +
  'category::text AS category';

/**
 * Geographic radius search (master spec §K.1 "search radius"). Returns published,
 * non-deleted, geocoded properties within `radiusMetres` of (lat, lng), ordered
 * nearest-first, combined with the same filters as {@link searchProperties}.
 *
 * Built as a parameterised raw query: only `$N` placeholders go into the SQL
 * string, every value is bound (no interpolation), so there is no injection
 * surface. RLS still scopes the rows to the tenant (the query runs inside
 * withTenant). The query itself is verified against real PostGIS in the
 * Testcontainers integration suite; this builder is unit-tested with a fake client.
 */
export async function searchPropertiesNear(
  client: PropertyRawClient,
  options: NearSearchOptions,
): Promise<PropertySearchResult> {
  const values: unknown[] = [];
  /** Bind a value and return its `$N` placeholder. */
  const bind = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  // Centre point — reused by the WHERE (ST_DWithin) and the ORDER BY (distance).
  const point = `ST_SetSRID(ST_MakePoint(${bind(options.lng)}, ${bind(options.lat)}), 4326)::geography`;

  const conditions = [
    'published_at IS NOT NULL',
    'deleted_at IS NULL',
    'geog IS NOT NULL',
    `ST_DWithin(geog, ${point}, ${bind(options.radiusMetres)})`,
  ];
  if (options.saleType) conditions.push(`sale_type = ${bind(options.saleType)}::sale_type`);
  if (options.listingType) {
    conditions.push(`listing_type = ${bind(options.listingType)}::listing_type`);
  }
  if (options.priceMin != null) conditions.push(`price >= ${bind(options.priceMin)}`);
  if (options.priceMax != null) conditions.push(`price <= ${bind(options.priceMax)}`);
  if (options.bedroomsMin != null) conditions.push(`bedrooms >= ${bind(options.bedroomsMin)}`);
  if (options.bathroomsMin != null) conditions.push(`bathrooms >= ${bind(options.bathroomsMin)}`);
  if (options.location) {
    conditions.push(
      `(town ILIKE ${bind(`%${options.location}%`)} OR postcode LIKE ${bind(`${options.location.toUpperCase()}%`)})`,
    );
  }
  const whereSql = conditions.join(' AND ');
  const whereValues = [...values]; // snapshot before the page params (count omits them)

  const pageSize = clamp(options.pageSize ?? DEFAULT_PAGE_SIZE, 1, 60);
  const page = Math.max(1, options.page ?? 1);
  const skip = (page - 1) * pageSize;

  const rowsSql =
    `SELECT ${RADIUS_SELECT} FROM properties WHERE ${whereSql} ` +
    `ORDER BY geog <-> ${point} LIMIT ${bind(pageSize)} OFFSET ${bind(skip)}`;
  const countSql = `SELECT count(*)::int AS count FROM properties WHERE ${whereSql}`;

  const [rows, countRows] = await Promise.all([
    client.$queryRawUnsafe<PropertyRow[]>(rowsSql, ...values),
    client.$queryRawUnsafe<Array<{ count: number }>>(countSql, ...whereValues),
  ]);
  const total = Number(countRows[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({ id: row.id, ...toCardProps(row) })),
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
    displayAddress: row.displayAddress,
    town: row.town ?? null,
    postcode: row.postcode,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    priceValue: row.price != null ? row.price / 100 : null,
    marketStatus: row.marketStatus,
    vertical: toVerticalFacts(row),
  };
}

/** Map a §J Property row's per-vertical extension columns to the public facts (FR-F-3). */
export function toVerticalFacts(row: PropertyRow): PropertyVerticalFacts {
  return {
    listingType: row.listingType ?? 'residential',
    isOffPlan: row.isOffPlan ?? false,
    developmentName: row.developmentName ?? null,
    vatPayable: row.vatPayable ?? null,
    annualBusinessRates: row.annualBusinessRates ?? null,
    useClass: row.useClass ?? null,
    annualTurnover: row.annualTurnover ?? null,
    grossProfit: row.grossProfit ?? null,
    netProfit: row.netProfit ?? null,
    yearsTrading: row.yearsTrading ?? null,
    staffCount: row.staffCount ?? null,
    currentAnnualRent: row.currentAnnualRent ?? null,
    isConfidential: row.isConfidential ?? false,
    bedCount: row.bedCount ?? null,
    cqcRating: row.cqcRating ?? null,
    cqcInspectionUrl: row.cqcInspectionUrl ?? null,
    isGoingConcern: row.isGoingConcern ?? false,
  };
}

/** Minimal reader for the sitemap (slug + last-modified per published property). */
export interface PropertySitemapReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<Array<{ slug: string; updatedAt: Date }>>;
  };
}

/** Published, non-deleted properties for the sitemap (FR-O-8), newest-modified first. */
export async function listPropertiesForSitemap(
  db: PropertySitemapReader,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return db.property.findMany({
    where: { publishedAt: { not: null }, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { slug: true, updatedAt: true },
  });
}
