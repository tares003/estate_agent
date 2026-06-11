'use server';

import { canRepairTransition, repairStatusUpdateSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-G repair triage (master spec §G.5, FR-G-6/FR-G-7): a staff member advances a
// ticket through the status workflow. RBAC-gated on `repair_request.write`
// (fail-closed before any read/write). Transitions are held to the §G.5 allow-list
// (illegal moves are refused before any write); rejecting requires a reason, which
// is stored on the ticket's `rejected_reason` (§G.6). Every transition writes BOTH
// a `repair_status_history` row (from/to, actor, notes — FR-G-7) AND an
// `audit_logs` row, inside the same tenant (RLS) transaction (G4). Drives a form
// via `useActionState`.

interface RepairTriageClient extends AuditWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; status: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  repairStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a status change, consumed by `useActionState`. */
export interface RepairStatusState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function setRepairStatus(
  _prevState: RepairStatusState,
  formData: FormData,
): Promise<RepairStatusState> {
  const parsed = repairStatusUpdateSchema.safeParse({
    repairId: field(formData, 'repairId'),
    to: field(formData, 'to'),
    notes: field(formData, 'notes'),
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

  const { repairId, to, notes } = parsed.data;
  const actor = await getStaffActor();
  const actorUserId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: RepairStatusState = { ok: false, errors: [{ message: 'Repair not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairTriageClient;
    const existing = await tx.repairRequest.findFirst({ where: { id: repairId } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const from = existing.status;
    if (!canRepairTransition(from, to)) {
      result = {
        ok: false,
        errors: [{ message: `This repair cannot move from its current status to "${to}".` }],
      };
      return;
    }
    const data: Record<string, unknown> = { status: to };
    if (to === 'rejected') {
      data['rejectedReason'] = notes;
    }
    await tx.repairRequest.update({ where: { id: repairId }, data });
    await tx.repairStatusEvent.create({
      data: {
        tenantId,
        repairRequestId: repairId,
        fromStatus: from,
        toStatus: to,
        actorUserId,
        notes: notes ?? null,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_request.status_changed',
      entity: 'repair_request',
      entityId: repairId,
      diff: { status: { from, to } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
