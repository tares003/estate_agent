'use server';

import { canTransition, enquiryStatusUpdateSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-I CRM (FR-I-2/7): a staff member moves an enquiry through the status
// workflow. RBAC-gated on `enquiry.write` (fail-closed before any read/write); the
// transition is validated against the allow-list (illegal moves write nothing);
// the change + reason (when `lost`) are recorded in an `audit_logs` row inside the
// same tenant-scoped transaction (G4). Drives a form via `useActionState`.

/** The tenant-scoped client surface this action reads/writes through. */
interface EnquiryStatusClient extends AuditWriter {
  enquiry: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; status: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a status update, consumed by `useActionState`. */
export interface EnquiryStatusState {
  ok: boolean;
  status?: string;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function updateEnquiryStatus(
  _prevState: EnquiryStatusState,
  formData: FormData,
): Promise<EnquiryStatusState> {
  const parsed = enquiryStatusUpdateSchema.safeParse({
    enquiryId: field(formData, 'enquiryId'),
    to: field(formData, 'to'),
    reason: field(formData, 'reason'),
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
  const { enquiryId, to, reason } = parsed.data;

  // RBAC gate — fail closed BEFORE any read/write (a status change is a write).
  try {
    await requireStaffPermission('enquiry.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to update enquiries.' }] };
  }

  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: EnquiryStatusState = { ok: false, errors: [{ message: 'Enquiry not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as EnquiryStatusClient;
    const row = await tx.enquiry.findFirst({ where: { id: enquiryId } });
    if (!row) {
      return; // result stays the not-found default
    }
    const from = row.status;
    if (!canTransition(from, to)) {
      result = {
        ok: false,
        errors: [{ message: `An enquiry cannot move from ${from} to ${to}.` }],
      };
      return;
    }
    await tx.enquiry.update({ where: { id: enquiryId }, data: { status: to } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'enquiry.status_changed',
      entity: 'enquiry',
      entityId: enquiryId,
      diff: reason ? { status: { from, to }, reason } : { status: { from, to } },
      ip,
    });
    result = { ok: true, status: to };
  });
  return result;
}
