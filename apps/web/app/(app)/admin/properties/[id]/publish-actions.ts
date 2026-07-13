'use server';

import { z } from 'zod';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-H property management (FR-H-2): the UNPUBLISH half of the listing
// lifecycle — unpublishing returns a live listing to draft. PUBLISHING is only
// reachable through `publishWithPreflight` (publish-preflight-actions.ts), which
// evaluates the §H.5 Tab 9 checklist and requires a typed reason to override
// (FR-F-8); a publish request posted here is REFUSED before any read or write, so
// a crafted POST cannot bypass the checklist (audit finding
// publish-preflight-checklist-bypassed). RBAC-gated on `property.publish`
// (fail-closed before any read/write); the change is recorded in an `audit_logs`
// row in the same tenant-scoped transaction (G4). Drives a form via
// `useActionState`.

const idSchema = z.string().uuid();

interface PublishClient extends AuditWriter {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a publish/unpublish, consumed by `useActionState`. */
export interface PublishState {
  ok: boolean;
  errors?: FormErrorItem[];
}

export async function setPropertyPublished(
  _prevState: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const parsedId = idSchema.safeParse(formData.get('id'));
  if (!parsedId.success) {
    return { ok: false, errors: [{ message: 'Invalid request.' }] };
  }
  const id = parsedId.data;
  const publish = formData.get('publish') === 'true';

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.publish');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to publish listings.' }] };
  }

  // FR-F-8 — publishing runs ONLY through the pre-publish checklist
  // (publishWithPreflight). Refuse before touching the tenant scope: no read,
  // no write, no audit row for a request this action does not own.
  if (publish) {
    return {
      ok: false,
      errors: [
        { message: 'Publishing runs through the pre-publish checklist on the listing page.' },
      ],
    };
  }

  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: PublishState = { ok: false, errors: [{ message: 'Property not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PublishClient;
    const existing = await tx.property.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return; // result stays the not-found default
    }
    await tx.property.update({
      where: { id },
      data: { publishedAt: null },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.unpublished',
      entity: 'property',
      entityId: id,
      ip,
    });
    result = { ok: true };
  });
  return result;
}
