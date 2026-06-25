import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-F FR-F-1 — Property entity schema verification.
//
// FR-F-1: "A property record shall capture every attribute listed in master spec
// Section F (identification, lifecycle, pricing, specification, location,
// descriptions, media, agent assignment, SEO, audit metadata)."
//
// The core spine (reference / slug / listingType / saleType / marketStatus /
// price / lat-long) already landed with the §J catalogue wave and is asserted by
// src/core-entities.test.ts; this unit asserts the FULL Section F attribute set
// now hung on the same Property entity (FR-F-2: one entity discriminated by
// listing_type — never a table per vertical), plus the new pricing /
// specification / location / SEO enums and the expanded media/document metadata.
//
// Like the sibling schema units (core-entities / satellite-entities) this is
// schema-only: it asserts against the Prisma schema source text. The properties
// table already carries its tenant_isolation RLS policy (0003) and PostGIS
// column (0004); FR-F-1 only ADDs columns to that existing table (created by
// `prisma db push`), so it introduces NO new table and NO new RLS migration.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const re = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(re);
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

function enumBlock(name: string): string {
  const re = new RegExp(`enum ${name} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(re);
  expect(match, `enum ${name} should be declared`).not.toBeNull();
  return match![0];
}

// ─────────────────────────────────────────────────────────────────────────────
// New Section F enums + their snake_case @@map name + the canonical values the
// spec enumerates. Values that derive directly from master spec Section F.
// ─────────────────────────────────────────────────────────────────────────────
const NEW_ENUMS: ReadonlyArray<{ name: string; table: string; values: readonly string[] }> = [
  {
    name: 'PublicationStatus',
    table: 'publication_status',
    values: ['draft', 'in_review', 'published', 'archived'],
  },
  {
    name: 'PriceQualifier',
    table: 'price_qualifier',
    values: [
      'none',
      'offers_in_excess_of',
      'offers_over',
      'offers_in_region_of',
      'guide_price',
      'fixed_price',
      'oiro',
      'poa',
      'from',
    ],
  },
  {
    name: 'RentFrequency',
    table: 'rent_frequency',
    values: ['per_calendar_month', 'per_week', 'per_annum'],
  },
  {
    name: 'LetType',
    table: 'let_type',
    values: ['long_let', 'short_let', 'student', 'room', 'hmo'],
  },
  {
    name: 'PropertyCategory',
    table: 'property_category',
    values: [
      'house',
      'flat',
      'bungalow',
      'studio',
      'maisonette',
      'commercial',
      'land',
      'room',
      'retail',
      'office',
      'industrial',
      'leisure',
      'business',
      'care_home',
      'hmo',
      'mixed_use',
    ],
  },
  {
    name: 'Tenure',
    table: 'tenure',
    values: [
      'freehold',
      'leasehold',
      'share_of_freehold',
      'commonhold',
      'long_leasehold',
      'virtual_freehold',
      'unknown',
    ],
  },
  {
    name: 'CouncilTaxBand',
    table: 'council_tax_band',
    values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'exempt', 'unknown'],
  },
  {
    name: 'EpcRating',
    table: 'epc_rating',
    values: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'pending'],
  },
  {
    name: 'FurnishedStatus',
    table: 'furnished_status',
    values: ['furnished', 'part_furnished', 'unfurnished', 'optional'],
  },
];

describe('FR-F-1 new Section F enums — presence + canonical naming', () => {
  it.each(NEW_ENUMS)('declares enum $name mapped to $table', ({ name, table }) => {
    expect(schema).toMatch(new RegExp(`enum ${name} \\{`));
    expect(enumBlock(name)).toContain(`@@map("${table}")`);
  });

  it.each(NEW_ENUMS)('enum $name carries every Section F value', ({ name, values }) => {
    const block = enumBlock(name);
    for (const value of values) {
      expect(block, `${name} should carry "${value}"`).toMatch(
        new RegExp(`^\\s*${value}\\s*$`, 'm'),
      );
    }
  });
});

describe('FR-F-1 §F identification + lifecycle attributes', () => {
  it('keeps the catalogue entity named Property (never Listing/House) — FR-F-2', () => {
    expect(schema).toMatch(/\bmodel Property\b/);
    expect(schema).not.toMatch(/\bmodel (Listing|House)\b/);
  });

  it('captures the unique internal reference and external identifier', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/reference\s+String/);
    // optional external id for portal-feed / CRM imports
    expect(block).toMatch(/externalId\s+String\?\s+@map\("external_id"\)/);
    // reference is unique per tenant
    expect(block).toMatch(/@@unique\(\[tenantId, reference\]\)/);
  });

  it('derives a per-tenant unique URL slug from title + location (FR-F-4/11)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/slug\s+String/);
    expect(block).toMatch(/@@unique\(\[tenantId, slug\]\)/);
  });

  it('captures the title used to build the slug', () => {
    expect(modelBlock('Property')).toMatch(/title\s+String\?/);
  });

  it('discriminates by listingType + saleType + marketStatus (FR-F-2)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/listingType\s+ListingType/);
    expect(block).toMatch(/saleType\s+SaleType/);
    expect(block).toMatch(/marketStatus\s+MarketStatus/);
  });

  it('carries the publication status (draft / in_review / published / archived)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(
      /publicationStatus\s+PublicationStatus\s+@default\(draft\)\s+@map\("publication_status"\)/,
    );
  });

  it('carries the new-home flag (filters the new-homes-only search)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/isNewHome\s+Boolean\s+@default\(false\)\s+@map\("is_new_home"\)/);
  });

  it('carries the featured / show-on-homepage / show-price / display-order flags', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/isFeatured\s+Boolean\s+@default\(false\)\s+@map\("is_featured"\)/);
    expect(block).toMatch(
      /showOnHomepage\s+Boolean\s+@default\(false\)\s+@map\("show_on_homepage"\)/,
    );
    // when showPrice is off the public display reads "POA"
    expect(block).toMatch(/showPrice\s+Boolean\s+@default\(true\)\s+@map\("show_price"\)/);
    expect(block).toMatch(/displayOrder\s+Int\s+@default\(0\)\s+@map\("display_order"\)/);
  });
});

describe('FR-F-1 §F pricing attributes', () => {
  it('keeps the asking price (pence) and adds the price qualifier', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/price\s+Int\?/);
    expect(block).toMatch(
      /priceQualifier\s+PriceQualifier\s+@default\(none\)\s+@map\("price_qualifier"\)/,
    );
  });

  it('captures the lettings pricing fields (rent frequency / deposits / min tenancy / let type)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/rentFrequency\s+RentFrequency\?\s+@map\("rent_frequency"\)/);
    expect(block).toMatch(/depositAmount\s+Int\?\s+@map\("deposit_amount"\)/);
    expect(block).toMatch(/holdingDeposit\s+Int\?\s+@map\("holding_deposit"\)/);
    expect(block).toMatch(/minTenancyMonths\s+Int\?\s+@map\("min_tenancy_months"\)/);
    expect(block).toMatch(/letType\s+LetType\?\s+@map\("let_type"\)/);
  });

  it('captures the availability date', () => {
    expect(modelBlock('Property')).toMatch(/availableFrom\s+DateTime\?\s+@map\("available_from"\)/);
  });
});

describe('FR-F-1 §F specification attributes', () => {
  it('captures category + sub-category', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/category\s+PropertyCategory\?/);
    expect(block).toMatch(/subCategory\s+String\?\s+@map\("sub_category"\)/);
  });

  it('keeps room counts (bedrooms / bathrooms / receptions)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/bedrooms\s+Int\?/);
    expect(block).toMatch(/bathrooms\s+Int\?/);
    expect(block).toMatch(/receptions\s+Int\?/);
  });

  it('captures internal + plot size in both imperial and metric', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/internalSqft\s+Int\?\s+@map\("internal_sqft"\)/);
    expect(block).toMatch(/internalSqm\s+Int\?\s+@map\("internal_sqm"\)/);
    expect(block).toMatch(/plotSqft\s+Int\?\s+@map\("plot_sqft"\)/);
    expect(block).toMatch(/plotSqm\s+Int\?\s+@map\("plot_sqm"\)/);
  });

  it('captures tenure + leasehold detail (years / ground rent / service charge)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/tenure\s+Tenure\?/);
    expect(block).toMatch(/leaseYearsRemaining\s+Int\?\s+@map\("lease_years_remaining"\)/);
    expect(block).toMatch(/groundRent\s+Int\?\s+@map\("ground_rent"\)/);
    expect(block).toMatch(/serviceCharge\s+Int\?\s+@map\("service_charge"\)/);
  });

  it('captures council tax band + EPC rating + EPC score', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/councilTaxBand\s+CouncilTaxBand\?\s+@map\("council_tax_band"\)/);
    expect(block).toMatch(/epcRating\s+EpcRating\?\s+@map\("epc_rating"\)/);
    expect(block).toMatch(/epcScore\s+Int\?\s+@map\("epc_score"\)/);
  });

  it('captures furnished status + free-text spec fields', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/furnishedStatus\s+FurnishedStatus\?\s+@map\("furnished_status"\)/);
    expect(block).toMatch(/parking\s+String\?/);
    expect(block).toMatch(/outdoorSpace\s+String\?\s+@map\("outdoor_space"\)/);
    expect(block).toMatch(/chainStatus\s+String\?\s+@map\("chain_status"\)/);
    expect(block).toMatch(/heating\s+String\?/);
    expect(block).toMatch(/constructionYear\s+Int\?\s+@map\("construction_year"\)/);
    expect(block).toMatch(/listedStatus\s+String\?\s+@map\("listed_status"\)/);
  });
});

describe('FR-F-1 §F location attributes', () => {
  it('keeps the public display address + postcode + prefix + town/county', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/displayAddress\s+String\s+@map\("display_address"\)/);
    expect(block).toMatch(/postcode\s+String/);
    expect(block).toMatch(/postcodePrefix\s+String\?\s+@map\("postcode_prefix"\)/);
    expect(block).toMatch(/town\s+String\?/);
    expect(block).toMatch(/county\s+String\?/);
  });

  it('captures the staff-only internal address (never shown publicly)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/internalAddressLine1\s+String\?\s+@map\("internal_address_line1"\)/);
    expect(block).toMatch(/internalAddressLine2\s+String\?\s+@map\("internal_address_line2"\)/);
  });

  it('captures city + country', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/city\s+String\?/);
    expect(block).toMatch(/country\s+String\s+@default\("United Kingdom"\)/);
  });

  it('keeps coordinates and adds the hide-exact-address flag (FR-F-9)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/latitude\s+Float\?/);
    expect(block).toMatch(/longitude\s+Float\?/);
    expect(block).toMatch(
      /hideExactAddress\s+Boolean\s+@default\(false\)\s+@map\("hide_exact_address"\)/,
    );
  });
});

describe('FR-F-1 §F descriptions attributes', () => {
  it('keeps a short headline + full description', () => {
    const block = modelBlock('Property');
    // existing core `description` is retained as the full rich-text body
    expect(block).toMatch(/description\s+String\?/);
    expect(block).toMatch(/shortDescription\s+String\?\s+@map\("short_description"\)/);
  });

  it('captures key features, area description and free-text notes as JSON/text', () => {
    const block = modelBlock('Property');
    // key features are a list of short phrases — stored as JSON on the entity
    expect(block).toMatch(/keyFeatures\s+Json\s+@default\("\[\]"\)\s+@map\("key_features"\)/);
    expect(block).toMatch(/areaDescription\s+String\?\s+@map\("area_description"\)/);
    expect(block).toMatch(/additionalNotes\s+String\?\s+@map\("additional_notes"\)/);
  });
});

describe('FR-F-1 §F media + documents attributes', () => {
  it('captures the headline media URLs on the entity', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/mainImageUrl\s+String\?\s+@map\("main_image_url"\)/);
    expect(block).toMatch(/videoTourUrl\s+String\?\s+@map\("video_tour_url"\)/);
    expect(block).toMatch(/virtualTourUrl\s+String\?\s+@map\("virtual_tour_url"\)/);
    expect(block).toMatch(/brochureUrl\s+String\?\s+@map\("brochure_url"\)/);
    expect(block).toMatch(/materialInfoUrl\s+String\?\s+@map\("material_info_url"\)/);
  });

  it('expands PropertyImage with the full §F.1 media metadata', () => {
    const block = modelBlock('PropertyImage');
    // retained core fields
    expect(block).toMatch(/url\s+String/);
    expect(block).toMatch(/sortOrder\s+Int\s+@default\(0\)\s+@map\("sort_order"\)/);
    expect(block).toMatch(/isPrimary\s+Boolean\s+@default\(false\)\s+@map\("is_primary"\)/);
    // §F.1: thumbnail + large variants, caption, is-floorplan flag, file size
    expect(block).toMatch(/thumbnailUrl\s+String\?\s+@map\("thumbnail_url"\)/);
    expect(block).toMatch(/largeUrl\s+String\?\s+@map\("large_url"\)/);
    expect(block).toMatch(/caption\s+String\?/);
    expect(block).toMatch(/isFloorplan\s+Boolean\s+@default\(false\)\s+@map\("is_floorplan"\)/);
    expect(block).toMatch(/fileSizeBytes\s+Int\?\s+@map\("file_size_bytes"\)/);
  });

  it('expands DocumentType with the full §F.1 paperwork set', () => {
    const block = enumBlock('DocumentType');
    for (const value of [
      'epc',
      'floorplan',
      'brochure',
      'material_information',
      'lease',
      'planning',
      'survey',
      'other',
    ]) {
      expect(block, `DocumentType should carry "${value}"`).toMatch(
        new RegExp(`^\\s*${value}\\s*$`, 'm'),
      );
    }
  });

  it('expands PropertyDocument with the full §F.1 document metadata', () => {
    const block = modelBlock('PropertyDocument');
    expect(block).toMatch(/type\s+DocumentType/);
    expect(block).toMatch(/title\s+String/);
    expect(block).toMatch(/url\s+String/);
    // §F.1: file name, file size, MIME type, public-download flag
    expect(block).toMatch(/fileName\s+String\?\s+@map\("file_name"\)/);
    expect(block).toMatch(/fileSizeBytes\s+Int\?\s+@map\("file_size_bytes"\)/);
    expect(block).toMatch(/mimeType\s+String\?\s+@map\("mime_type"\)/);
    expect(block).toMatch(/isPublic\s+Boolean\s+@default\(true\)\s+@map\("is_public"\)/);
  });
});

describe('FR-F-1 §F agent + branch assignment attributes', () => {
  it('keeps the branch FK and adds primary + secondary agent + contact overrides', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/branchId\s+String\?\s+@map\("branch_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/primaryAgentId\s+String\?\s+@map\("primary_agent_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/secondaryAgentId\s+String\?\s+@map\("secondary_agent_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/contactPhone\s+String\?\s+@map\("contact_phone"\)/);
    expect(block).toMatch(/contactEmail\s+String\?\s+@map\("contact_email"\)/);
  });
});

describe('FR-F-1 §F SEO attributes', () => {
  it('captures meta title / description / OG image / canonical / no-index', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/metaTitle\s+String\?\s+@map\("meta_title"\)/);
    expect(block).toMatch(/metaDescription\s+String\?\s+@map\("meta_description"\)/);
    expect(block).toMatch(/ogImageUrl\s+String\?\s+@map\("og_image_url"\)/);
    expect(block).toMatch(/canonicalUrl\s+String\?\s+@map\("canonical_url"\)/);
    expect(block).toMatch(/noIndex\s+Boolean\s+@default\(false\)\s+@map\("no_index"\)/);
  });
});

describe('FR-F-1 §F audit metadata + soft delete (FR-F-10)', () => {
  it('keeps created/updated/published timestamps and the soft-delete column', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("created_at"\)/);
    expect(block).toMatch(/updatedAt\s+DateTime\s+@updatedAt\s+@map\("updated_at"\)/);
    expect(block).toMatch(/publishedAt\s+DateTime\?\s+@map\("published_at"\)/);
    // soft delete — the row is retained but hidden (FR-F-10)
    expect(block).toMatch(/deletedAt\s+DateTime\?\s+@map\("deleted_at"\)/);
  });

  it('records the creating + last-updating user (soft references)', () => {
    const block = modelBlock('Property');
    expect(block).toMatch(/createdByUserId\s+String\?\s+@map\("created_by_user_id"\)\s+@db\.Uuid/);
    expect(block).toMatch(/updatedByUserId\s+String\?\s+@map\("updated_by_user_id"\)\s+@db\.Uuid/);
  });
});

describe('FR-F-1 indexing — the public catalogue stays cheap to query', () => {
  it('keeps the tenant-scoped status / type indexes', () => {
    const block = modelBlock('Property');
    expect(block).toContain('@@index([tenantId])');
    expect(block).toContain('@@index([tenantId, marketStatus])');
    expect(block).toContain('@@index([tenantId, saleType, listingType])');
  });
});
