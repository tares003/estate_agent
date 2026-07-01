import type {
  PropertyCategory,
  PropertyCommercialUseClass,
  PropertyCouncilTaxBand,
  PropertyCqcRating,
  PropertyEpcRating,
  PropertyListingType,
  PropertyMarketStatus,
  PropertyPriceQualifier,
  PropertyPublicationStatus,
  PropertySaleType,
  PropertyTenure,
} from '@estate/validators';

// EPIC-H property management (FR-H-2 write) / EPIC-F (FR-F-1) read model — loads ONE
// listing's CORE editable fields for the admin edit form. The public catalogue read
// models (properties.ts) return only PUBLISHED listings; this returns any non-deleted
// listing (drafts included) so staff can edit work-in-progress. Pure query-shaping over
// a STRUCTURAL Prisma client (DB-free to unit-test, mirrors blog.ts / admin-properties.ts);
// the live query runs tenant-scoped (RLS) via withTenant in the /admin/properties/[id]/edit
// route. Soft-deleted listings are excluded.
//
// This covers exactly the CORE field set the create/update write schemas
// (propertyCreateSchema / propertyWriteUpdateSchema) accept. The per-vertical extension
// fields (FR-F-3, master spec §F.1–§F.6) are a later slice and are NOT read here.

/** The Property columns the admin edit form pre-fills. `price` is stored in pence. */
export interface PropertyEditModel {
  id: string;
  reference: string;
  listingType: PropertyListingType;
  saleType: PropertySaleType;
  slug: string;
  title: string | null;
  /** Stored price in pence (the form shows pounds). */
  price: number | null;
  priceQualifier: PropertyPriceQualifier | null;
  marketStatus: PropertyMarketStatus | null;
  bedrooms: number | null;
  bathrooms: number | null;
  category: PropertyCategory | null;
  tenure: PropertyTenure | null;
  councilTaxBand: PropertyCouncilTaxBand | null;
  epcRating: PropertyEpcRating | null;
  displayAddress: string;
  postcode: string;
  town: string | null;
  description: string | null;
  /** The key-features tags — stored as a JSON array of strings. */
  keyFeatures: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  publicationStatus: PropertyPublicationStatus | null;
  // ── FR-F-3 per-vertical extension fields (§F.3–§F.6). ────────────────────────
  isOffPlan: boolean;
  developmentName: string | null;
  vatPayable: boolean | null;
  annualBusinessRates: number | null;
  useClass: PropertyCommercialUseClass | null;
  annualTurnover: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  yearsTrading: number | null;
  staffCount: number | null;
  currentAnnualRent: number | null;
  isConfidential: boolean;
  bedCount: number | null;
  cqcRating: PropertyCqcRating | null;
  cqcInspectionUrl: string | null;
  isGoingConcern: boolean;
}

/** The raw Property row shape the read touches (a real PrismaClient satisfies it). */
interface PropertyEditRow {
  id: string;
  reference: string;
  listingType: PropertyListingType;
  saleType: PropertySaleType;
  slug: string;
  title: string | null;
  price: number | null;
  priceQualifier: PropertyPriceQualifier | null;
  marketStatus: PropertyMarketStatus | null;
  bedrooms: number | null;
  bathrooms: number | null;
  category: PropertyCategory | null;
  tenure: PropertyTenure | null;
  councilTaxBand: PropertyCouncilTaxBand | null;
  epcRating: PropertyEpcRating | null;
  displayAddress: string;
  postcode: string;
  town: string | null;
  description: string | null;
  keyFeatures: unknown;
  metaTitle: string | null;
  metaDescription: string | null;
  publicationStatus: PropertyPublicationStatus | null;
  isOffPlan: boolean;
  developmentName: string | null;
  vatPayable: boolean | null;
  annualBusinessRates: number | null;
  useClass: PropertyCommercialUseClass | null;
  annualTurnover: number | null;
  grossProfit: number | null;
  netProfit: number | null;
  yearsTrading: number | null;
  staffCount: number | null;
  currentAnnualRent: number | null;
  isConfidential: boolean;
  bedCount: number | null;
  cqcRating: PropertyCqcRating | null;
  cqcInspectionUrl: string | null;
  isGoingConcern: boolean;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PropertyEditReader {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<PropertyEditRow | null>;
  };
}

/** Coerce a stored `keyFeatures` JSON value into a clean string array. */
export function normaliseKeyFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/**
 * Load a single listing's core editable fields by id (drafts included; soft-deleted
 * excluded). Returns null when the id is unknown within the tenant, so the route 404s.
 * RLS scopes the query; here the client is structural so it is DB-free to test.
 */
export async function getPropertyForEdit(
  db: PropertyEditReader,
  id: string,
): Promise<PropertyEditModel | null> {
  const row = await db.property.findFirst({ where: { id, deletedAt: null } });
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    listingType: row.listingType,
    saleType: row.saleType,
    slug: row.slug,
    title: row.title,
    price: row.price,
    priceQualifier: row.priceQualifier,
    marketStatus: row.marketStatus,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    category: row.category,
    tenure: row.tenure,
    councilTaxBand: row.councilTaxBand,
    epcRating: row.epcRating,
    displayAddress: row.displayAddress,
    postcode: row.postcode,
    town: row.town,
    description: row.description,
    keyFeatures: normaliseKeyFeatures(row.keyFeatures),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    publicationStatus: row.publicationStatus,
    isOffPlan: row.isOffPlan,
    developmentName: row.developmentName,
    vatPayable: row.vatPayable,
    annualBusinessRates: row.annualBusinessRates,
    useClass: row.useClass,
    annualTurnover: row.annualTurnover,
    grossProfit: row.grossProfit,
    netProfit: row.netProfit,
    yearsTrading: row.yearsTrading,
    staffCount: row.staffCount,
    currentAnnualRent: row.currentAnnualRent,
    isConfidential: row.isConfidential,
    bedCount: row.bedCount,
    cqcRating: row.cqcRating,
    cqcInspectionUrl: row.cqcInspectionUrl,
    isGoingConcern: row.isGoingConcern,
  };
}
