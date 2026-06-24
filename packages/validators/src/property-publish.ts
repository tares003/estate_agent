import { z } from 'zod';

// EPIC-F FR-F-8 — a property shall not be publishable unless the pre-flight
// checklist in master spec §H.5 Tab 9 is satisfied, or explicitly overridden with
// a typed reason recorded in the audit log. This module is the pure policy: the
// eleven Tab 9 items as a deterministic function over a property's denormalised
// publish-state, shared between the admin Server Action (the gate) and the
// right-rail UI (the green/red ticks). No DB, no I/O — DB-free to unit-test.

/** Min photos before a listing may publish (§H.5 Tab 9 — "At least 5 photos"). */
export const PUBLISH_MIN_PHOTOS = 5;
/** Min key features before a listing may publish (Tab 9 — "At least 3 key features"). */
export const PUBLISH_MIN_KEY_FEATURES = 3;
/** Min full-description word count before a listing may publish (Tab 9 — "≥ 150 words"). */
export const PUBLISH_MIN_DESCRIPTION_WORDS = 150;
/** Max length of the override reason captured for the audit log. */
export const PUBLISH_OVERRIDE_REASON_MAX = 2000;

/**
 * The eleven §H.5 Tab 9 checklist keys, in display order. Each maps 1:1 to a
 * checklist line in the spec ("At least 5 photos", "Main image set", …).
 */
export const PUBLISH_PREFLIGHT_ITEMS = [
  'photos',
  'mainImage',
  'floorplan',
  'epc',
  'materialInformation',
  'description',
  'keyFeatures',
  'seo',
  'latLng',
  'councilTaxBand',
  'tenure',
] as const;

/** One §H.5 Tab 9 checklist item key. */
export type PublishPreflightKey = (typeof PUBLISH_PREFLIGHT_ITEMS)[number];

/** Human-readable label for each checklist item (verbatim §H.5 Tab 9 wording). */
export const PUBLISH_PREFLIGHT_LABELS: Record<PublishPreflightKey, string> = {
  photos: 'At least 5 photos',
  mainImage: 'Main image set',
  floorplan: 'Floorplan uploaded',
  epc: 'EPC uploaded or marked exempt',
  materialInformation: 'Material Information completed',
  description: 'Full description ≥ 150 words',
  keyFeatures: 'At least 3 key features',
  seo: 'SEO meta title and description set',
  latLng: 'Lat/lng confirmed',
  councilTaxBand: 'Council tax band set',
  tenure: 'Tenure confirmed',
};

/**
 * The denormalised publish-state the checklist reads. The caller (the Server
 * Action) derives this from the property row plus aggregate reads over its images
 * and documents — keeping the policy a pure function of plain values.
 */
export interface PublishPreflightInput {
  /** Count of images attached to the listing. */
  imageCount: number;
  /** Whether one image is flagged as the main (primary) image. */
  hasMainImage: boolean;
  /** Whether a floorplan image or document is attached. */
  hasFloorplan: boolean;
  /** Whether an EPC document is attached. */
  hasEpcDocument: boolean;
  /** The recorded EPC rating, if any (`pending` means the certificate is still awaited). */
  epcRating: string | null;
  /** Whether the Material Information document/section is completed. */
  hasMaterialInformation: boolean;
  /** The full marketing description (word count is measured against this). */
  description: string | null;
  /** Count of key-feature tags on the listing. */
  keyFeatureCount: number;
  /** The SEO meta title. */
  metaTitle: string | null;
  /** The SEO meta description. */
  metaDescription: string | null;
  /** Confirmed latitude (null until a pin is dropped / postcode resolves). */
  latitude: number | null;
  /** Confirmed longitude. */
  longitude: number | null;
  /** The council tax band (`exempt` is itself a valid, satisfying value). */
  councilTaxBand: string | null;
  /** The tenure (any non-null value confirms it). */
  tenure: string | null;
}

/** The evaluated state of one checklist item. */
export interface PublishPreflightItem {
  key: PublishPreflightKey;
  label: string;
  satisfied: boolean;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function wordCount(value: string | null): number {
  if (!hasText(value)) return 0;
  return (value as string).trim().split(/\s+/).length;
}

/**
 * The EPC item is satisfied by a held certificate — either an uploaded EPC
 * document, OR a recorded rating that is a real band (any value other than the
 * `pending` placeholder, which means the certificate is still awaited).
 */
function epcSatisfied(input: PublishPreflightInput): boolean {
  if (input.hasEpcDocument) return true;
  return hasText(input.epcRating) && input.epcRating !== 'pending';
}

const PREDICATES: Record<PublishPreflightKey, (input: PublishPreflightInput) => boolean> = {
  photos: (i) => i.imageCount >= PUBLISH_MIN_PHOTOS,
  mainImage: (i) => i.hasMainImage,
  floorplan: (i) => i.hasFloorplan,
  epc: epcSatisfied,
  materialInformation: (i) => i.hasMaterialInformation,
  description: (i) => wordCount(i.description) >= PUBLISH_MIN_DESCRIPTION_WORDS,
  keyFeatures: (i) => i.keyFeatureCount >= PUBLISH_MIN_KEY_FEATURES,
  seo: (i) => hasText(i.metaTitle) && hasText(i.metaDescription),
  latLng: (i) => i.latitude !== null && i.longitude !== null,
  councilTaxBand: (i) => hasText(i.councilTaxBand),
  tenure: (i) => hasText(i.tenure),
};

/**
 * Evaluate the §H.5 Tab 9 pre-flight checklist against a listing's publish-state.
 * Returns the eleven items in order with each item's satisfied flag.
 */
export function evaluatePublishPreflight(input: PublishPreflightInput): PublishPreflightItem[] {
  return PUBLISH_PREFLIGHT_ITEMS.map((key) => ({
    key,
    label: PUBLISH_PREFLIGHT_LABELS[key],
    satisfied: PREDICATES[key](input),
  }));
}

/** True when every checklist item is satisfied (the listing may publish unforced). */
export function isPublishReady(items: PublishPreflightItem[]): boolean {
  return items.every((item) => item.satisfied);
}

/** The keys of the checklist items that are NOT satisfied. */
export function unmetPreflightKeys(items: PublishPreflightItem[]): PublishPreflightKey[] {
  return items.filter((item) => !item.satisfied).map((item) => item.key);
}

// FR-F-8 — when the checklist is not all-green, publishing requires "Override and
// publish anyway" WITH a typed reason that goes into the audit log. This schema
// validates that override gesture. It captures no personal data (it is an admin
// staff action over business data), so no GDPR-consent affirmation applies.
// eslint-disable-next-line estate/gdpr-consent
export const publishOverrideSchema = z
  .object({
    /** Whether the staff member is overriding a failing checklist. */
    override: z.boolean().default(false),
    /** The typed override reason — required (and non-blank) when overriding. */
    reason: z.string().trim().max(PUBLISH_OVERRIDE_REASON_MAX).optional(),
  })
  .refine((data) => !data.override || hasText(data.reason), {
    message: 'A reason is required to override the pre-flight checklist.',
    path: ['reason'],
  });

/** A validated publish-override gesture. */
export type PublishOverride = z.infer<typeof publishOverrideSchema>;
