'use server';

import { canTransition, enquiryConversionSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, getStaffUserId, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-I CRM (FR-I-6): converting an enquiry produces a Contact record (one of the
// four party types) linked back to the originating enquiry, and moves the enquiry
// to `converted`. RBAC-gated on `enquiry.write` (fail-closed before any read/write);
// the conversion is only allowed from a state that can reach `converted` (the same
// transition allow-list as the status workflow); the new contact + status change
// are recorded in an `audit_logs` row inside the same tenant transaction (G4). The
// enquiry's already-consented contact details are reused — no new personal-data
// capture (so no fresh GDPR consent is required).

/** The tenant-scoped client surface this action reads/writes through. */
interface EnquiryConversionClient extends AuditWriter {
  enquiry: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{
      id: string;
      status: string;
      name: string;
      email: string | null;
      phone: string | null;
    } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  contact: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  enquiryStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a conversion, consumed by `useActionState`. */
export interface EnquiryConversionState {
  ok: boolean;
  contactId?: string;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function convertEnquiry(
  _prevState: EnquiryConversionState,
  formData: FormData,
): Promise<EnquiryConversionState> {
  const parsed = enquiryConversionSchema.safeParse({
    enquiryId: field(formData, 'enquiryId'),
    contactType: field(formData, 'contactType'),
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
  const { enquiryId, contactType } = parsed.data;

  // RBAC gate — fail closed BEFORE any read/write (a conversion is a write).
  try {
    await requireStaffPermission('enquiry.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to update enquiries.' }] };
  }

  const actor = await getStaffActor();
  const changedByAgentId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: EnquiryConversionState = { ok: false, errors: [{ message: 'Enquiry not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as EnquiryConversionClient;
    const enquiry = await tx.enquiry.findFirst({ where: { id: enquiryId } });
    if (!enquiry) {
      return; // result stays the not-found default
    }
    const from = enquiry.status;
    if (!canTransition(from, 'converted')) {
      result = {
        ok: false,
        errors: [{ message: `An enquiry cannot be converted from ${from}.` }],
      };
      return;
    }
    const contact = await tx.contact.create({
      data: {
        tenantId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        type: contactType,
        sourceEnquiryId: enquiryId,
      },
    });
    await tx.enquiry.update({ where: { id: enquiryId }, data: { status: 'converted' } });
    await tx.enquiryStatusEvent.create({
      data: { tenantId, enquiryId, fromStatus: from, toStatus: 'converted', changedByAgentId },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'enquiry.converted',
      entity: 'enquiry',
      entityId: enquiryId,
      diff: {
        status: { from, to: 'converted' },
        contact: { id: contact.id, type: contactType },
      },
      ip,
    });
    result = { ok: true, contactId: contact.id };
  });
  return result;
}
