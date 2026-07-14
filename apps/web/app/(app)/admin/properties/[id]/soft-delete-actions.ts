'use server';

import { z } from 'zod';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../lib/tenant.js';

// EPIC-F FR-F-10 — soft-deletion (audit finding property-soft-delete-action-missing).
// Every read path already filters `deletedAt: null` (public catalogue, detail,
// sitemap, admin list + detail, publish/market-status/image actions); this action is
// the one WRITE path that sets it, completing the lifecycle: a soft-deleted property
// disappears from every public surface and is not enumerable from the public API.
//
// RBAC-gated on `property.write` — fail-closed BEFORE any read/write. The permission
// catalogue (@estate/auth) defines the `write` verb as create/edit/ARCHIVE, which is
// exactly what a soft delete is (the row is retained; there is no hard delete and no
// `property.manage` permission in the catalogue). The deletion is recorded in an
// `audit_logs` row — with actor, IP and user-agent (FR-H-17) — in the same
// tenant-scoped transaction (G4). Already-deleted rows read as not-found, so the
// action cannot re-delete (the audit trail records one deletion per lifecycle).
// FR-F-10 defines no restore path, so none is offered here.

const idSchema = z.string().uuid();

interface SoftDeleteClient extends AuditWriter {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a soft delete, consumed by `useActionState`. */
export interface SoftDeleteState {
  ok: boolean;
  errors?: FormErrorItem[];
}

export async function softDeleteProperty(
  _prevState: SoftDeleteState,
  formData: FormData,
): Promise<SoftDeleteState> {
  const parsedId = idSchema.safeParse(formData.get('id'));
  if (!parsedId.success) {
    return { ok: false, errors: [{ message: 'Invalid request.' }] };
  }
  const id = parsedId.data;

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to delete listings.' }] };
  }

  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  let result: SoftDeleteState = { ok: false, errors: [{ message: 'Property not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SoftDeleteClient;
    // Only a live row qualifies — an absent or already-deleted listing is not-found.
    const existing = await tx.property.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const deletedAt = new Date();
    await tx.property.update({ where: { id }, data: { deletedAt } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.soft_deleted',
      entity: 'property',
      entityId: id,
      diff: { deletedAt: { from: null, to: deletedAt.toISOString() } },
      ip,
      userAgent,
    });
    result = { ok: true };
  });
  return result;
}
