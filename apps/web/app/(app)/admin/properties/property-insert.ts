import {
  PROPERTY_VERTICAL_FIELD_OWNERS,
  propertySlugBase,
  slugify,
  sqftToSqm,
  type PropertyCreate,
  type PropertyWriteUpdate,
} from '@estate/validators';
import { audit, type AuditWriter } from '@estate/db';

// EPIC-F FR-F-1 / FR-F-4 / FR-F-11 — the INTERNAL property-insert path shared by the
// admin create action and the bulk import (EPIC-X). This module deliberately carries NO
// 'use server' directive: it is plain server-side code imported BY the Server Actions,
// so nothing here is ever registered as a network-callable action endpoint (audit
// finding exported-helper-becomes-ungated-server-action). The exported actions in
// actions.ts / import/actions.ts gate fail-closed on RBAC + pack entitlement BEFORE
// calling in here.

/** The minimal Property + audit write surface the insert path needs. */
export interface PropertyCreateClient extends AuditWriter {
  property: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; slug: string } | null>;
    findMany(args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<{ slug: string }[]>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string; slug: string }>;
  };
}

/** The identity + provenance context a single property insert needs. */
export interface PropertyInsertContext {
  tenantId: string;
  /** The audit actor string (`agent:<id>`). */
  actor: string;
  /** The staff user id for the created/updated FK columns; null for the dev fallback. */
  createdByUserId: string | null;
  /** Originating IP for the audit row, when known. */
  ip: string | null;
  /**
   * Originating User-Agent for the audit row (FR-H-17), when known. Optional so
   * batch callers without a meaningful UA (e.g. the EPIC-X import) may omit it.
   */
  userAgent?: string | null;
}

/**
 * Choose a unique slug within the tenant (FR-F-4 / FR-F-11). Given a desired base slug
 * and the set of slugs already taken, returns the base when free, else the first
 * `base-2`, `base-3`, … that is free. Deterministic — a pure function of its inputs.
 */
export function disambiguateSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Map the validated core fields to the Property column write. `input.price` is in
 * pounds; the column stores pence. Absent optional fields are omitted (create leaves
 * the column default); blanks the caller wants cleared arrive as their own values.
 */
export function coreData(input: PropertyCreate | PropertyWriteUpdate): Record<string, unknown> {
  const data: Record<string, unknown> = {
    displayAddress: input.displayAddress,
    postcode: input.postcode,
  };
  if (input.title !== undefined) data['title'] = input.title;
  if (input.description !== undefined) data['description'] = input.description;
  if (input.keyFeatures !== undefined) data['keyFeatures'] = input.keyFeatures;
  if (input.price !== undefined) data['price'] = input.price * 100;
  if (input.priceQualifier !== undefined) data['priceQualifier'] = input.priceQualifier;
  if (input.marketStatus !== undefined) data['marketStatus'] = input.marketStatus;
  if (input.bedrooms !== undefined) data['bedrooms'] = input.bedrooms;
  if (input.bathrooms !== undefined) data['bathrooms'] = input.bathrooms;
  // §F specification — the internal size is CAPTURED in square feet; the square-metre
  // column is DERIVED here (the admin editor's "auto-converted sqm"), so the two columns
  // can never drift and staff never enter the same measurement twice.
  if (input.internalSqft !== undefined) {
    data['internalSqft'] = input.internalSqft;
    data['internalSqm'] = sqftToSqm(input.internalSqft);
  }
  if (input.category !== undefined) data['category'] = input.category;
  if (input.tenure !== undefined) data['tenure'] = input.tenure;
  if (input.councilTaxBand !== undefined) data['councilTaxBand'] = input.councilTaxBand;
  if (input.epcRating !== undefined) data['epcRating'] = input.epcRating;
  if (input.metaTitle !== undefined) data['metaTitle'] = input.metaTitle;
  if (input.metaDescription !== undefined) data['metaDescription'] = input.metaDescription;
  if (input.publicationStatus !== undefined) data['publicationStatus'] = input.publicationStatus;
  if (input.town !== undefined) data['town'] = input.town;
  // FR-F-3 — the per-vertical extension columns (§F.3–§F.6). Each is written only when
  // present in the submission; the isolation check has already rejected foreign fields.
  for (const field of Object.keys(PROPERTY_VERTICAL_FIELD_OWNERS)) {
    const value = (input as Record<string, unknown>)[field];
    if (value !== undefined) data[field] = value;
  }
  return data;
}

/**
 * Insert ONE validated property + its `property.created` audit row on an already-open
 * tenant transaction (FR-F-1 / FR-F-4). The slug is taken from the submission when
 * present, else derived from title/town/postcode (falling back to the reference), then
 * made unique against `taken` — the caller-supplied set of slugs already claimed in the
 * same transaction. When inserting a batch, the caller adds each returned slug to
 * `taken` so successive rows in the SAME run don't collide (FR-F-11).
 *
 * Shared so bulk import (EPIC-X) creates properties through the EXACT create path —
 * same disambiguation, same column mapping, same audit event — rather than a parallel
 * insert. Pure of session/tenant resolution: every I/O input is a parameter, so it is
 * unit-testable with a fake `tx`. NOT a Server Action — the first argument is a live
 * transaction handle only the gated actions can supply.
 */
export async function insertPropertyRow(
  tx: PropertyCreateClient,
  ctx: PropertyInsertContext,
  input: PropertyCreate,
  taken: Set<string>,
): Promise<{ id: string; slug: string }> {
  const postcodePrefix = input.postcode.split(' ')[0];
  const desiredBase =
    (input.slug ?? propertySlugBase({ title: input.title, town: input.town, postcodePrefix })) ||
    slugify(input.reference);
  const slug = disambiguateSlug(desiredBase, taken);

  const created = await tx.property.create({
    data: {
      tenantId: ctx.tenantId,
      reference: input.reference,
      listingType: input.listingType,
      saleType: input.saleType,
      slug,
      createdByUserId: ctx.createdByUserId,
      updatedByUserId: ctx.createdByUserId,
      // EPIC-X FR-X-4 — persist the source CRM's identifier so a later upsert run can
      // match this record on external_id (a first import followed by a re-run must
      // de-duplicate). Absent for hand-authored listings.
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...coreData(input),
    },
  });
  await audit(tx, {
    tenantId: ctx.tenantId,
    actor: ctx.actor,
    action: 'property.created',
    entity: 'property',
    entityId: created.id,
    diff: { reference: input.reference, slug, listingType: input.listingType },
    ip: ctx.ip,
    userAgent: ctx.userAgent ?? null,
  });
  // Reserve the minted slug so a following row in the same batch disambiguates past it.
  taken.add(slug);
  return { id: created.id, slug };
}

/** The minimal Property-update + audit write surface the upsert path needs. */
export interface PropertyUpdateRowClient extends AuditWriter {
  property: {
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/**
 * EPIC-X FR-X-4 — update ONE matched property from a validated import row, on an
 * already-open tenant transaction. The upsert's update half of the SHARED write path:
 * the imported columns go through the SAME `coreData` mapping as create (pounds →
 * pence, per-vertical extensions, optional fields absent = column unchanged), plus the
 * identity columns (`reference`, `externalId` when carried) and `updatedByUserId`.
 *
 * Deliberately NEVER rewritten: `slug` (URL stability — a slug change belongs to the
 * admin edit flow with its FR-F-5 redirect), `tenantId` / `createdByUserId` (creation
 * provenance) and `publishedAt` / `deletedAt` (publish + lifecycle are their own
 * audited actions). Emits the `property.updated` audit event on the same transaction
 * (G4), recording which identity field the row was matched on. NOT a Server Action —
 * the first argument is a live transaction handle only the gated actions can supply.
 */
export async function updatePropertyRow(
  tx: PropertyUpdateRowClient,
  ctx: PropertyInsertContext,
  input: PropertyCreate,
  target: { id: string },
  matchedOn: 'reference' | 'externalId',
): Promise<void> {
  const data: Record<string, unknown> = {
    reference: input.reference,
    listingType: input.listingType,
    saleType: input.saleType,
    updatedByUserId: ctx.createdByUserId,
    ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
    ...coreData(input),
  };
  await tx.property.update({ where: { id: target.id }, data });
  await audit(tx, {
    tenantId: ctx.tenantId,
    actor: ctx.actor,
    action: 'property.updated',
    entity: 'property',
    entityId: target.id,
    // Compact by design: a bulk run updates hundreds of rows, so the diff names the
    // matched identity + the columns written rather than duplicating their values.
    diff: { reference: input.reference, matchedOn, fields: Object.keys(data) },
    ip: ctx.ip,
    userAgent: ctx.userAgent ?? null,
  });
}
