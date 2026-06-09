'use server';

import { enquiryNoteCreateSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, getStaffUserId, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-I CRM (FR-I-5): a staff member adds a threaded note to an enquiry. A note is
// staff-internal by default (surfaces in client-facing comms only when explicitly
// made client-visible). RBAC-gated on `enquiry.write` (fail-closed before any
// read/write); the note + its visibility are recorded in an `audit_logs` row inside
// the same tenant-scoped transaction (G4). Drives a form via `useActionState`.

/** The tenant-scoped client surface this action reads/writes through. */
interface EnquiryNoteClient extends AuditWriter {
  enquiry: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
  note: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** The result of adding a note, consumed by `useActionState`. */
export interface EnquiryNoteState {
  ok: boolean;
  noteId?: string;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function addEnquiryNote(
  _prevState: EnquiryNoteState,
  formData: FormData,
): Promise<EnquiryNoteState> {
  // A note is internal unless the form explicitly opts it into client visibility.
  const isInternal = formData.get('isInternal') !== 'false';
  const parsed = enquiryNoteCreateSchema.safeParse({
    enquiryId: field(formData, 'enquiryId'),
    body: field(formData, 'body'),
    isInternal,
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
  const { enquiryId, body, isInternal: internal } = parsed.data;

  // RBAC gate — fail closed BEFORE any read/write (adding a note is a write).
  try {
    await requireStaffPermission('enquiry.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to update enquiries.' }] };
  }

  const actor = await getStaffActor();
  const authorAgentId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: EnquiryNoteState = { ok: false, errors: [{ message: 'Enquiry not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as EnquiryNoteClient;
    const enquiry = await tx.enquiry.findFirst({ where: { id: enquiryId } });
    if (!enquiry) {
      return; // result stays the not-found default
    }
    const created = await tx.note.create({
      data: {
        tenantId,
        entityType: 'enquiry',
        entityId: enquiryId,
        body,
        isInternal: internal,
        authorAgentId,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'enquiry.note_added',
      entity: 'enquiry',
      entityId: enquiryId,
      diff: { note: { id: created.id, isInternal: internal } },
      ip,
    });
    result = { ok: true, noteId: created.id };
  });
  return result;
}
