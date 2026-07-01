'use server';

import {
  PROPERTY_VERTICAL_FIELD_OWNERS,
  propertyCreateSchema,
  propertySlugBase,
  propertyWriteUpdateSchema,
  slugify,
  validatePropertyVerticalFields,
  type PropertyCreate,
  type PropertyListingType,
  type PropertyWriteUpdate,
} from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, getStaffUserId, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-F FR-F-1 / FR-F-4 / FR-F-5 (and FR-O-12) — the audited admin WRITE path for a
// property: create + update Server Actions. Each gates fail-closed on the staff
// `property.write` permission BEFORE any read/write; validates the submission with the
// @estate/validators write schema; then mutates + writes the audit row(s) in ONE
// tenant-scoped transaction (G4).
//
// FR-F-4 — the URL slug is auto-generated from title/town/postcode-prefix with a numeric
// disambiguation suffix on collision, deterministic per FR-F-11 (the tenant's existing
// slugs are read inside the same transaction, so two saves can't mint the same slug).
//
// FR-F-5 / FR-O-12 — WHEN AN UPDATE CHANGES THE SLUG, a managed 301 Redirect is created
// from the old `/properties/<oldSlug>` path to the new one (mirroring the managed-redirects
// create path) so the previous URL keeps resolving; both the property update and the
// redirect creation are audited in the same transaction.
//
// The property write form UI is a separate follow-on slice; these actions are the
// validated, tested action layer the form (and bulk import) will call.

/** The public path prefix a property detail page lives under (the 301 source/target). */
const PROPERTY_PATH_PREFIX = '/properties/';

/** Build the public detail path for a slug. */
function propertyPath(slug: string): string {
  return `${PROPERTY_PATH_PREFIX}${slug}`;
}

/** The minimal Property + Redirect write surface these actions need. */
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

interface PropertyUpdateClient extends AuditWriter {
  property: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; slug: string; listingType?: string } | null>;
    findMany(args: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
    }): Promise<{ slug: string }[]>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  redirect: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** The result of a property write, consumed by `useActionState`. */
export interface PropertyWriteState {
  ok: boolean;
  errors?: FormErrorItem[];
  /** The persisted row id (create) — so the caller can route to the edit page. */
  id?: string;
  /** The final slug the row was written with (after disambiguation). */
  slug?: string;
}

function deny(message: string): PropertyWriteState {
  return { ok: false, errors: [{ message }] };
}

/** Map Zod issues to the form's field-linked error items. */
function fromZod(issues: { path: (string | number)[]; message: string }[]): PropertyWriteState {
  return {
    ok: false,
    errors: issues.map((issue) => {
      const key = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
      return key === undefined
        ? { message: issue.message }
        : { field: key, message: issue.message };
    }),
  };
}

/**
 * Choose a unique slug within the tenant (FR-F-4 / FR-F-11). Given a desired base slug
 * and the set of slugs already taken, returns the base when free, else the first
 * `base-2`, `base-3`, … that is free. Deterministic — a pure function of its inputs.
 */
function disambiguateSlug(base: string, taken: ReadonlySet<string>): string {
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
function coreData(input: PropertyCreate | PropertyWriteUpdate): Record<string, unknown> {
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

/** The extension fields submitted as numeric form inputs (whole-pound / count). */
const VERTICAL_NUMBER_FIELDS = [
  'annualBusinessRates',
  'annualTurnover',
  'grossProfit',
  'netProfit',
  'yearsTrading',
  'staffCount',
  'currentAnnualRent',
  'bedCount',
] as const;

/** The extension fields submitted as checkboxes (present ⇒ true, absent ⇒ false). */
const VERTICAL_BOOLEAN_FIELDS = [
  'isOffPlan',
  'vatPayable',
  'isConfidential',
  'isGoingConcern',
] as const;

/**
 * FR-F-3 — coerce the raw per-vertical form values into the shapes the write schema
 * expects: numeric inputs to numbers (blank ⇒ omitted), checkboxes to booleans (a
 * checkbox posts its name only when ticked, so an absent field is `false`). Only the
 * subsection matching the listing type is rendered, so at most one vertical's fields
 * arrive; the isolation check still guards against a crafted submission.
 */
function parseVerticalFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of VERTICAL_NUMBER_FIELDS) {
    const value = raw[field];
    if (value !== undefined && value !== '') out[field] = Number(value);
  }
  for (const field of VERTICAL_BOOLEAN_FIELDS) {
    // A ticked checkbox posts a truthy value ("on"); an unticked one posts nothing.
    if (raw[field] !== undefined) out[field] = true;
  }
  // Text / enum extension fields pass through as-is when present and non-blank.
  for (const field of ['developmentName', 'useClass', 'cqcRating', 'cqcInspectionUrl'] as const) {
    const value = raw[field];
    if (value !== undefined && value !== '') out[field] = value;
  }
  return out;
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
}

/**
 * Insert ONE validated property + its `property.created` audit row on an already-open
 * tenant transaction (FR-F-1 / FR-F-4). The slug is taken from the submission when
 * present, else derived from title/town/postcode (falling back to the reference), then
 * made unique against `taken` — the caller-supplied set of slugs already claimed in the
 * same transaction. When inserting a batch, the caller adds each returned slug to
 * `taken` so successive rows in the SAME run don't collide (FR-F-11).
 *
 * Extracted so bulk import (EPIC-X) creates properties through the EXACT create path —
 * same disambiguation, same column mapping, same audit event — rather than a parallel
 * insert. Pure of session/tenant resolution: every I/O input is a parameter, so it is
 * unit-testable with a fake `tx`.
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
  });
  // Reserve the minted slug so a following row in the same batch disambiguates past it.
  taken.add(slug);
  return { id: created.id, slug };
}

// FR-F-1 / FR-F-4 — create a property. The slug is taken from the submission when
// provided, else auto-generated from title/town/postcode; either way it is made unique
// within the tenant before the insert.
export async function createProperty(
  _prevState: PropertyWriteState,
  formData: FormData,
): Promise<PropertyWriteState> {
  const raw = Object.fromEntries(formData.entries());
  const keyFeatures = formData
    .getAll('keyFeatures')
    .map(String)
    .filter((v) => v.length > 0);
  const parsed = propertyCreateSchema.safeParse({
    ...raw,
    slug: raw['slug'] === '' ? undefined : raw['slug'],
    keyFeatures: keyFeatures.length > 0 ? keyFeatures : undefined,
    price: raw['price'] === undefined || raw['price'] === '' ? undefined : Number(raw['price']),
    bedrooms:
      raw['bedrooms'] === undefined || raw['bedrooms'] === '' ? undefined : Number(raw['bedrooms']),
    bathrooms:
      raw['bathrooms'] === undefined || raw['bathrooms'] === ''
        ? undefined
        : Number(raw['bathrooms']),
    ...parseVerticalFields(raw),
  });
  if (!parsed.success) {
    return fromZod(parsed.error.issues);
  }

  // FR-F-3 — conditional-by-listing-type isolation: reject any extension field that does
  // not belong to this listing type before it can be persisted.
  const verticalIssues = validatePropertyVerticalFields(
    parsed.data.listingType,
    parsed.data as unknown as Record<string, unknown>,
  );
  if (verticalIssues.length > 0) {
    return {
      ok: false,
      errors: verticalIssues.map((i) => ({ field: i.field, message: i.message })),
    };
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return deny('You do not have permission to create listings.');
  }

  const input = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const createdByUserId = await getStaffUserId();
  const ip = await getRequestIp();

  let result: PropertyWriteState = deny('The property could not be created.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PropertyCreateClient;
    const existing = await tx.property.findMany({ where: {}, select: { slug: true } });
    const taken = new Set(existing.map((row) => row.slug));
    const { id, slug } = await insertPropertyRow(
      tx,
      { tenantId, actor, createdByUserId, ip },
      input,
      taken,
    );
    result = { ok: true, id, slug };
  });
  return result;
}

// FR-F-1 / FR-F-5 / FR-O-12 — update a property. When the slug changes, a 301 Redirect
// from the old `/properties/<oldSlug>` path to the new one is created (unless one already
// exists for that source), and BOTH the update and the redirect are audited in the same
// transaction.
export async function updateProperty(
  _prevState: PropertyWriteState,
  formData: FormData,
): Promise<PropertyWriteState> {
  const raw = Object.fromEntries(formData.entries());
  const keyFeatures = formData
    .getAll('keyFeatures')
    .map(String)
    .filter((v) => v.length > 0);
  const parsed = propertyWriteUpdateSchema.safeParse({
    ...raw,
    slug: raw['slug'] === '' ? undefined : raw['slug'],
    keyFeatures: keyFeatures.length > 0 ? keyFeatures : undefined,
    price: raw['price'] === undefined || raw['price'] === '' ? undefined : Number(raw['price']),
    bedrooms:
      raw['bedrooms'] === undefined || raw['bedrooms'] === '' ? undefined : Number(raw['bedrooms']),
    bathrooms:
      raw['bathrooms'] === undefined || raw['bathrooms'] === ''
        ? undefined
        : Number(raw['bathrooms']),
    ...parseVerticalFields(raw),
  });
  if (!parsed.success) {
    return fromZod(parsed.error.issues);
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return deny('You do not have permission to edit listings.');
  }

  const input: PropertyWriteUpdate = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const updatedByUserId = await getStaffUserId();
  const ip = await getRequestIp();

  let result: PropertyWriteState = deny('Property not found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PropertyUpdateClient;
    const existing = await tx.property.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) {
      return; // result stays the not-found default
    }

    // FR-F-3 — enforce vertical isolation against the EFFECTIVE listing type: the
    // submitted one if the edit restates it, else the row's current type. A field that
    // does not belong is rejected before any write (no partial mutation).
    const effectiveListingType = (input.listingType ??
      existing.listingType ??
      'residential') as PropertyListingType;
    const verticalIssues = validatePropertyVerticalFields(
      effectiveListingType,
      input as unknown as Record<string, unknown>,
    );
    if (verticalIssues.length > 0) {
      result = {
        ok: false,
        errors: verticalIssues.map((i) => ({ field: i.field, message: i.message })),
      };
      return;
    }

    // Resolve the target slug (only when the submission carries one). A change is made
    // unique against the tenant's OTHER properties, then honoured as the new slug.
    let nextSlug = existing.slug;
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const others = await tx.property.findMany({
        where: { id: { not: input.id } },
        select: { slug: true },
      });
      const taken = new Set(others.map((row) => row.slug));
      nextSlug = disambiguateSlug(input.slug, taken);
    }
    const slugChanged = nextSlug !== existing.slug;

    const data: Record<string, unknown> = {
      ...coreData(input),
      slug: nextSlug,
      updatedByUserId,
    };
    if (input.listingType !== undefined) data['listingType'] = input.listingType;
    if (input.saleType !== undefined) data['saleType'] = input.saleType;

    await tx.property.update({ where: { id: input.id }, data });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.updated',
      entity: 'property',
      entityId: input.id,
      diff: slugChanged ? { slug: { from: existing.slug, to: nextSlug } } : { to: data },
      ip,
    });

    // FR-F-5 / FR-O-12 — the slug moved: keep the old URL alive with a managed 301.
    // Skip if a redirect already claims that source path (the unique index would throw).
    if (slugChanged) {
      const sourcePath = propertyPath(existing.slug);
      const destinationPath = propertyPath(nextSlug);
      const clash = await tx.redirect.findFirst({ where: { sourcePath } });
      if (!clash) {
        const redirect = await tx.redirect.create({
          data: { tenantId, sourcePath, destinationPath, type: 'r301' },
        });
        await audit(tx, {
          tenantId,
          actor,
          action: 'redirect.created',
          entity: 'redirect',
          entityId: redirect.id,
          diff: { sourcePath, destinationPath, type: 'r301', reason: 'property_slug_changed' },
          ip,
        });
      }
    }

    result = { ok: true, id: input.id, slug: nextSlug };
  });
  return result;
}
