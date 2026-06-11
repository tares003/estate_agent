'use server';

import { repairPropertyLinkSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-G repair triage (master spec §G.6): a staff member matches a ticket to a
// catalogue property ("property_id … matched by admin"), or unmatches it.
// RBAC-gated on `repair_request.write` (fail-closed before any read/write). The
// chosen property must exist INSIDE the tenant scope (the RLS-scoped lookup means
// a cross-tenant id simply looks unknown) and not be soft-deleted, checked before
// any write. The change is audited with a from/to diff (G4), inside the same
// tenant transaction. Drives a form via `useActionState`.

interface RepairMatchClient extends AuditWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; propertyId: string | null } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
}

/** The result of a match change, consumed by `useActionState`. */
export interface RepairMatchState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function setRepairProperty(
  _prevState: RepairMatchState,
  formData: FormData,
): Promise<RepairMatchState> {
  const parsed = repairPropertyLinkSchema.safeParse({
    repairId: field(formData, 'repairId'),
    propertyId: field(formData, 'propertyId'),
  });
  if (!parsed.success) {
    const errors: FormErrorItem[] = parsed.error.issues.map((issue) => {
      const fieldKey = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
      return fieldKey === undefined
        ? { message: issue.message }
        : { field: fieldKey, message: issue.message };
    });
    return { ok: false, errors };
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('repair_request.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to manage repairs.' }] };
  }

  const { repairId, propertyId } = parsed.data;
  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: RepairMatchState = { ok: false, errors: [{ message: 'Repair not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairMatchClient;
    const existing = await tx.repairRequest.findFirst({ where: { id: repairId } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const to = propertyId ?? null;
    if (to !== null) {
      const property = await tx.property.findFirst({ where: { id: to, deletedAt: null } });
      if (!property) {
        result = { ok: false, errors: [{ message: 'That property could not be found.' }] };
        return;
      }
    }
    await tx.repairRequest.update({ where: { id: repairId }, data: { propertyId: to } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_request.property_matched',
      entity: 'repair_request',
      entityId: repairId,
      diff: { propertyId: { from: existing.propertyId, to } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
