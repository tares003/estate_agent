'use server';

import {
  propertyCreateSchema,
  propertyWriteUpdateSchema,
  validatePropertyVerticalFields,
  type PropertyListingType,
  type PropertyWriteUpdate,
} from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { isListingTypePermitted } from '../../lib/packs.js';
import { getStaffActor, getStaffUserId, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import {
  coreData,
  disambiguateSlug,
  insertPropertyRow,
  type PropertyCreateClient,
} from './property-insert.js';

// EPIC-F FR-F-1 / FR-F-4 / FR-F-5 (and FR-O-12) — the audited admin WRITE path for a
// property: create + update Server Actions. Each gates fail-closed on the staff
// `property.write` permission BEFORE any read/write; enforces the EPIC-AD / G12 pack
// entitlement for the effective listing type SERVER-SIDE (mirroring the admin-form
// render gate, so a crafted POST cannot author a vertical the tenant has not enabled);
// validates the submission with the @estate/validators write schema; then mutates +
// writes the audit row(s) in ONE tenant-scoped transaction (G4).
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
// This module carries 'use server', so EVERY exported function becomes a network-callable
// Server Action endpoint: only the gated actions are exported. The internal insert path
// lives in property-insert.ts (no 'use server'), so it is never registered as an action.

/** The public path prefix a property detail page lives under (the 301 source/target). */
const PROPERTY_PATH_PREFIX = '/properties/';

/** Build the public detail path for a slug. */
function propertyPath(slug: string): string {
  return `${PROPERTY_PATH_PREFIX}${slug}`;
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

/**
 * The extension fields submitted as checkboxes. Each is paired in the form with a
 * hidden `false` companion so an unticked box still posts a value (a bare checkbox
 * submits nothing when unticked), letting an edit clear a previously-true flag.
 */
const VERTICAL_BOOLEAN_FIELDS = [
  'isOffPlan',
  'vatPayable',
  'isConfidential',
  'isGoingConcern',
] as const;

/**
 * FR-F-3 — coerce the raw per-vertical form values into the shapes the write schema
 * expects: numeric inputs to numbers (blank ⇒ omitted), checkboxes to booleans. Each
 * checkbox is paired with a hidden `false` companion in the form, so a rendered
 * subsection posts an explicit "on"/"false" the edit path uses to SET or CLEAR the
 * flag. Only the subsection matching the listing type is rendered, so at most one
 * vertical's fields arrive; the isolation check still guards a crafted submission.
 */
function parseVerticalFields(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of VERTICAL_NUMBER_FIELDS) {
    const value = raw[field];
    if (value !== undefined && value !== '') out[field] = Number(value);
  }
  for (const field of VERTICAL_BOOLEAN_FIELDS) {
    // The form pairs each checkbox with a hidden `false` companion, so a rendered
    // subsection always posts an explicit value: "on" when ticked, "false" when not.
    // Reading the value (not mere presence) lets an EDIT clear a flag that was true.
    // An absent field means the subsection was not rendered (a foreign vertical) and
    // is left untouched, so the isolation check does not reject it.
    const value = raw[field];
    if (value !== undefined) out[field] = value === 'on' || value === 'true';
  }
  // Text / enum extension fields pass through as-is when present and non-blank.
  for (const field of ['developmentName', 'useClass', 'cqcRating', 'cqcInspectionUrl'] as const) {
    const value = raw[field];
    if (value !== undefined && value !== '') out[field] = value;
  }
  return out;
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

  // EPIC-AD / G12 — pack entitlement, enforced SERVER-SIDE (not only at render): a
  // pack-gated vertical listing type may be authored only when the tenant's pack is
  // enabled. Fail closed BEFORE any write.
  if (!(await isListingTypePermitted(parsed.data.listingType))) {
    return deny('This listing type requires a pack that is not enabled for this tenant.');
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

    // EPIC-AD / G12 — pack entitlement against the EFFECTIVE listing type, enforced
    // SERVER-SIDE and fail-closed BEFORE any write (a lapsed pack blocks edits to the
    // vertical it gated, exactly like the render gate hides its form section).
    if (!(await isListingTypePermitted(effectiveListingType))) {
      result = deny('This listing type requires a pack that is not enabled for this tenant.');
      return;
    }

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
