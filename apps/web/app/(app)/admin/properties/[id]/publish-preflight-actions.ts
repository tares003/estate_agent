'use server';

import { z } from 'zod';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import {
  evaluatePublishPreflight,
  isPublishReady,
  publishOverrideSchema,
  unmetPreflightKeys,
  type PublishPreflightInput,
  type PublishPreflightKey,
} from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-F FR-F-8 — publish a listing through the §H.5 Tab 9 pre-flight checklist. A
// property is publishable only when the checklist is all-green, OR when the staff
// member explicitly overrides it with a TYPED reason — which is recorded in the
// audit log alongside the unmet items. Mirrors publish-actions.ts: RBAC fail-closed
// on `property.publish` before any read/write; the mutation + audit row run in one
// tenant-scoped transaction (G4). Drives a form via `useActionState`.

const idSchema = z.string().uuid();

/** The Property columns the checklist reads (drafts included; soft-deleted excluded). */
interface PreflightProperty {
  id: string;
  description: string | null;
  keyFeatures: unknown;
  metaTitle: string | null;
  metaDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  councilTaxBand: string | null;
  tenure: string | null;
  epcRating: string | null;
  materialInfoUrl: string | null;
}

interface PreflightClient extends AuditWriter {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<PreflightProperty | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  propertyImage: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
  propertyDocument: {
    findMany(args: { where: Record<string, unknown> }): Promise<{ type: string }[]>;
  };
}

/** The result of a publish attempt, consumed by `useActionState`. */
export interface PublishPreflightState {
  ok: boolean;
  errors?: FormErrorItem[];
  /** When publish is blocked, the unmet §H.5 Tab 9 checklist keys (so the UI can echo them). */
  unmet?: PublishPreflightKey[];
}

function deny(message: string): PublishPreflightState {
  return { ok: false, errors: [{ message }] };
}

/** Count the listing's key-feature tags from the JSON column (a string array). */
function keyFeatureCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export async function publishWithPreflight(
  _prevState: PublishPreflightState,
  formData: FormData,
): Promise<PublishPreflightState> {
  const parsedId = idSchema.safeParse(formData.get('id'));
  if (!parsedId.success) {
    return deny('Invalid request.');
  }
  const id = parsedId.data;

  const parsedOverride = publishOverrideSchema.safeParse({
    override: formData.get('override') === 'true',
    reason: formData.get('reason') ?? undefined,
  });
  // An override gesture with no/blank reason is rejected here, BEFORE the DB —
  // FR-F-8 requires a typed reason to override. (A non-override submission always
  // parses; the checklist itself decides whether it may proceed.)
  if (!parsedOverride.success) {
    return {
      ok: false,
      errors: parsedOverride.error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? { field, message: issue.message } : { message: issue.message };
      }),
    };
  }
  const override = parsedOverride.data.override;
  const reason = parsedOverride.data.reason ?? null;

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.publish');
  } catch {
    return deny('You do not have permission to publish listings.');
  }

  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: PublishPreflightState = deny('Property not found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PreflightClient;
    const existing = await tx.property.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return; // not-found default
    }

    // Aggregate the checklist's image + document state inside the tenant scope.
    const [imageCount, mainImage, floorplanImage, documents] = await Promise.all([
      tx.propertyImage.count({ where: { propertyId: id } }),
      tx.propertyImage.findFirst({ where: { propertyId: id, isPrimary: true } }),
      tx.propertyImage.findFirst({ where: { propertyId: id, isFloorplan: true } }),
      tx.propertyDocument.findMany({ where: { propertyId: id } }),
    ]);
    const docTypes = new Set(documents.map((doc) => doc.type));

    const checklistInput: PublishPreflightInput = {
      imageCount,
      hasMainImage: mainImage !== null,
      hasFloorplan: floorplanImage !== null || docTypes.has('floorplan'),
      hasEpcDocument: docTypes.has('epc'),
      epcRating: existing.epcRating,
      hasMaterialInformation:
        docTypes.has('material_information') ||
        (typeof existing.materialInfoUrl === 'string' && existing.materialInfoUrl.length > 0),
      description: existing.description,
      keyFeatureCount: keyFeatureCount(existing.keyFeatures),
      metaTitle: existing.metaTitle,
      metaDescription: existing.metaDescription,
      latitude: existing.latitude,
      longitude: existing.longitude,
      councilTaxBand: existing.councilTaxBand,
      tenure: existing.tenure,
    };

    const checklist = evaluatePublishPreflight(checklistInput);
    const ready = isPublishReady(checklist);
    const unmet = unmetPreflightKeys(checklist);

    if (!ready && !override) {
      // Blocked: the checklist is not all-green and no override was requested.
      result = {
        ok: false,
        errors: [
          {
            message:
              'This listing is not ready to publish. Resolve the checklist, or override with a reason.',
          },
        ],
        unmet,
      };
      return;
    }

    // Publish: either the checklist is all-green (override=false), or the staff
    // member is overriding it with a typed reason. Both write the same publishedAt
    // and an audit row whose diff records the override gesture (FR-F-8).
    await tx.property.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.published',
      entity: 'property',
      entityId: id,
      diff: override ? { override: true, reason, unmet } : { override: false },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
