'use server';

import { z } from 'zod';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-H property management (FR-H-2): publish / unpublish a listing. Publishing
// makes it visible on the public catalogue; unpublishing returns it to draft.
// RBAC-gated on `property.publish` (a distinct permission from `property.write`,
// fail-closed before any read/write); the change is recorded in an `audit_logs` row
// in the same tenant-scoped transaction (G4). Drives a form via `useActionState`.

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
      data: { publishedAt: publish ? new Date() : null },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: publish ? 'property.published' : 'property.unpublished',
      entity: 'property',
      entityId: id,
      ip,
    });
    result = { ok: true };
  });
  return result;
}
