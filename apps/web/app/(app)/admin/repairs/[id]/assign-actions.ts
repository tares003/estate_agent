'use server';

import { z } from 'zod';
import { canRepairTransition } from '@estate/validators';
import { audit, notify, withTenant, type AuditWriter, type NotificationWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { contractorLinkSecret, signContractorLink } from '../../../lib/contractor-access.js';
import { getDb } from '../../../lib/db.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestOrigin } from '../../../lib/tenant.js';

// EPIC-G repair triage (master spec §G.5/§G.6, FR-G-8): a staff member assigns a
// repair ticket to a contractor. RBAC-gated on `repair_request.write` (fail-closed).
// Assignment IS the §G.5 transition to `contractor_assigned`, so it is held to the
// transition allow-list (refused from a status that can't reach it). The contractor
// must exist in-tenant and be ACTIVE. In one tenant (RLS) transaction it sets the
// assigned contractor + status, writes the status-history event (FR-G-7) and the
// audit row (G4), and QUEUES the contractor's magic-link email — a signed,
// expiring, no-sign-in link to just this ticket (FR-G-8); the worker dispatches it
// (§H.13 — record intent, never send inline). Drives a form via `useActionState`.

interface AssignClient extends AuditWriter, NotificationWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; status: string; reference: string | null } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  contractor: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; name: string; email: string; active: boolean } | null>;
  };
  repairStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of an assignment, consumed by `useActionState`. */
export interface AssignContractorState {
  ok: boolean;
  errors?: FormErrorItem[];
}

const assignSchema = z.object({
  repairId: z.string().uuid(),
  contractorId: z.string().uuid(),
});

/** A contractor's magic-link is valid for 14 days — long enough to attend the job. */
const LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function deny(message: string): AssignContractorState {
  return { ok: false, errors: [{ message }] };
}

export async function assignContractor(
  _prevState: AssignContractorState,
  formData: FormData,
): Promise<AssignContractorState> {
  const parsed = assignSchema.safeParse({
    repairId: formData.get('repairId'),
    contractorId: formData.get('contractorId'),
  });
  if (!parsed.success) {
    return deny('Choose a contractor to assign.');
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('repair_request.write');
  } catch {
    return deny('You do not have permission to manage repairs.');
  }

  const { repairId, contractorId } = parsed.data;
  const actor = await getStaffActor();
  const actorUserId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();
  const origin = await getRequestOrigin();
  const secret = contractorLinkSecret();

  let result: AssignContractorState = deny('Repair not found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as AssignClient;
    const ticket = await tx.repairRequest.findFirst({ where: { id: repairId } });
    if (!ticket) {
      return; // result stays the not-found default
    }
    const contractor = await tx.contractor.findFirst({ where: { id: contractorId } });
    if (!contractor || !contractor.active) {
      result = deny('That contractor is not available.');
      return;
    }
    const from = ticket.status;
    if (!canRepairTransition(from, 'contractor_assigned')) {
      result = deny('Triage the ticket before assigning a contractor.');
      return;
    }

    await tx.repairRequest.update({
      where: { id: repairId },
      data: { assignedContractorId: contractorId, status: 'contractor_assigned' },
    });
    await tx.repairStatusEvent.create({
      data: {
        tenantId,
        repairRequestId: repairId,
        fromStatus: from,
        toStatus: 'contractor_assigned',
        actorUserId,
        notes: `Assigned to ${contractor.name}`,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_request.contractor_assigned',
      entity: 'repair_request',
      entityId: repairId,
      diff: { assignedContractorId: { from: null, to: contractorId } },
      ip,
    });

    // FR-G-8: the contractor's no-sign-in magic-link to this one ticket, queued
    // for the worker to send via the tenant's SMTP (§H.13).
    const token = signContractorLink(repairId, contractorId, Date.now() + LINK_TTL_MS, secret);
    const link = `${origin}/repairs/contractor/${token}`;
    await notify(tx, {
      tenantId,
      event: 'repair.contractor_assigned',
      channel: 'email',
      recipient: contractor.email,
      payload: { reference: ticket.reference ?? '', contractorName: contractor.name, link },
    });
    result = { ok: true };
  });
  return result;
}
