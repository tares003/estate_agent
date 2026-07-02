import { z } from 'zod';

// EPIC-X FR-X-3 — configurable CSV column mapping + preset CRM mappings.
//
// A bulk-import CSV rarely arrives with the platform's canonical field names in its
// header row — a Reapit export calls the reference "Agency Reference", Alto calls it
// "Ref", and so on. This module lets the importer translate an arbitrary source header
// onto a canonical property field BEFORE per-row validation, either via a named preset
// for a known UK CRM (Reapit, Alto, Jupix, Vebra, Rex) or via an in-form custom mapping.
//
// Nothing is persisted per tenant: the presets are CODE constants and a custom mapping
// travels with the single upload (as JSON in the FormData). `mappingSchema` is the shared
// Zod shape the import form (client) and the two Server Actions (server) parse that JSON
// with — the pure `csv-import-core` parser then applies the mapping. No schema change.

/**
 * The canonical property-create fields the importer understands as mapping TARGETS. Each
 * equals a `propertyCreateSchema` field name. This is the single source of truth for the
 * recognised columns; `csv-import-core` derives its parser column set from `ImportColumn`.
 */
export const IMPORT_COLUMNS = [
  'reference',
  'listingType',
  'saleType',
  'slug',
  'title',
  'description',
  'price',
  'priceQualifier',
  'marketStatus',
  'bedrooms',
  'bathrooms',
  'category',
  'tenure',
  'councilTaxBand',
  'epcRating',
  'metaTitle',
  'metaDescription',
  'publicationStatus',
  'displayAddress',
  'postcode',
  'town',
] as const;

/** A recognised canonical import column (mapping target). */
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const IMPORT_COLUMN_SET = new Set<string>(IMPORT_COLUMNS);

/** True when `value` is one of the recognised canonical import columns. */
export function isImportColumn(value: string): value is ImportColumn {
  return IMPORT_COLUMN_SET.has(value);
}

/**
 * The canonical fields `propertyCreateSchema` REQUIRES. A mapping that leaves any of
 * these unmapped cannot produce a valid row, so the editor surfaces them as errors and
 * `isMappingComplete` returns false until each is mapped.
 */
export const IMPORT_REQUIRED_COLUMNS = [
  'reference',
  'listingType',
  'saleType',
  'displayAddress',
  'postcode',
] as const satisfies readonly ImportColumn[];

/**
 * A translation from a SOURCE CSV header (as it appears in the upload's header row) to a
 * canonical `ImportColumn`. A header absent from the map, or mapped to `undefined`, is
 * left untranslated — the parser then treats it as-is (recognised only if it already
 * equals a canonical field name, otherwise ignored).
 */
export type ColumnMapping = Record<string, ImportColumn | undefined>;

/** The V1 CRM preset names (brief open-question 1: Reapit, Alto, Jupix, Vebra, Rex). */
export const CRM_PRESET_NAMES = ['reapit', 'alto', 'jupix', 'vebra', 'rex'] as const;

/** A named CRM preset. */
export type PresetName = (typeof CRM_PRESET_NAMES)[number];

// The preset header strings are the CRM's own export column names. They are best-effort
// V1 mappings; the brief defers exact confirmation to sprint kickoff, and adding a preset
// later needs no parser change (the core only ever sees a resolved `ColumnMapping`).

/** Reapit CSV export → canonical fields. */
export const REAPIT_PRESET: ColumnMapping = {
  'Agency Reference': 'reference',
  'Property Type': 'listingType',
  'Sale/Let': 'saleType',
  'Display Address': 'displayAddress',
  Postcode: 'postcode',
  Title: 'title',
  Description: 'description',
  Price: 'price',
  Bedrooms: 'bedrooms',
  Bathrooms: 'bathrooms',
  Town: 'town',
  Tenure: 'tenure',
};

/** Alto CSV export → canonical fields. */
export const ALTO_PRESET: ColumnMapping = {
  Ref: 'reference',
  Category: 'listingType',
  Type: 'saleType',
  Address: 'displayAddress',
  Postcode: 'postcode',
  Summary: 'title',
  Description: 'description',
  'Asking Price': 'price',
  Beds: 'bedrooms',
  Baths: 'bathrooms',
  Town: 'town',
};

/** Jupix CSV export → canonical fields. */
export const JUPIX_PRESET: ColumnMapping = {
  'Property Ref': 'reference',
  Department: 'listingType',
  'Transaction Type': 'saleType',
  'Address Line': 'displayAddress',
  Postcode: 'postcode',
  Heading: 'title',
  'Full Description': 'description',
  Price: 'price',
  Bedrooms: 'bedrooms',
  Bathrooms: 'bathrooms',
  Town: 'town',
};

/** Vebra CSV export → canonical fields. */
export const VEBRA_PRESET: ColumnMapping = {
  'Unique ID': 'reference',
  'Property Type': 'listingType',
  Status: 'saleType',
  'Street Address': 'displayAddress',
  Postcode: 'postcode',
  Title: 'title',
  Description: 'description',
  Price: 'price',
  Bedrooms: 'bedrooms',
  Bathrooms: 'bathrooms',
  Town: 'town',
};

/** Rex CSV export → canonical fields. */
export const REX_PRESET: ColumnMapping = {
  Reference: 'reference',
  'Listing Category': 'listingType',
  'Sale or Let': 'saleType',
  Address: 'displayAddress',
  Postcode: 'postcode',
  Headline: 'title',
  Description: 'description',
  'Advertised Price': 'price',
  Bedrooms: 'bedrooms',
  Bathrooms: 'bathrooms',
  Suburb: 'town',
};

const PRESETS: Record<PresetName, ColumnMapping> = {
  reapit: REAPIT_PRESET,
  alto: ALTO_PRESET,
  jupix: JUPIX_PRESET,
  vebra: VEBRA_PRESET,
  rex: REX_PRESET,
};

/** Return the code-defined mapping for a named CRM preset. */
export function getPreset(name: PresetName): ColumnMapping {
  return PRESETS[name];
}

/** Normalise a header for tolerant comparison (trim + collapse case). */
function normaliseHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Suggest a CRM preset for an uploaded file by comparing its header row against each
 * preset's source columns. The best match wins provided it recognises a MAJORITY of that
 * preset's headers (so a single coincidental column name does not force a wrong preset).
 * Returns `null` when no preset matches well — e.g. a raw canonical CSV (whose headers are
 * already the field names) or a bespoke export the admin will map by hand. Case- and
 * whitespace-insensitive.
 */
export function detectCrmPreset(headers: string[]): PresetName | null {
  const present = new Set(headers.map(normaliseHeader));
  if (present.size === 0) return null;

  let best: { name: PresetName; score: number } | null = null;
  for (const name of CRM_PRESET_NAMES) {
    const sourceHeaders = Object.keys(PRESETS[name]);
    const matched = sourceHeaders.filter((h) => present.has(normaliseHeader(h))).length;
    // Require a clear majority of the preset's headers to be present, so detection is
    // confident rather than opportunistic.
    const threshold = Math.ceil(sourceHeaders.length / 2);
    if (matched >= threshold && (best === null || matched > best.score)) {
      best = { name, score: matched };
    }
  }
  return best?.name ?? null;
}

/** The canonical columns a mapping does not yet map (from `IMPORT_REQUIRED_COLUMNS`). */
export function unmappedRequiredColumns(mapping: ColumnMapping): ImportColumn[] {
  const mappedTargets = new Set(Object.values(mapping));
  return IMPORT_REQUIRED_COLUMNS.filter((required) => !mappedTargets.has(required));
}

/** True when the mapping maps every required canonical field at least once. */
export function isMappingComplete(mapping: ColumnMapping): boolean {
  return unmappedRequiredColumns(mapping).length === 0;
}

/**
 * The shared mapping validator. A record from arbitrary source-header strings to a
 * recognised `ImportColumn`. Parsed on the client (before submit) and on the server
 * (before the parser applies it) so a tampered mapping can never target a field the
 * importer does not understand. Deliberately permissive on completeness — a partial or
 * empty mapping is valid input (the parser falls back to the raw header for anything
 * unmapped); required-field completeness is a separate UI concern (`isMappingComplete`).
 */
export const mappingSchema: z.ZodType<ColumnMapping> = z.record(
  z.string(),
  z.enum(IMPORT_COLUMNS),
);
