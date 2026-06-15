'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { contractorLinkSecret, verifyContractorLink } from '../../../../lib/contractor-access.js';
import { contractorNextStep } from '../../../../lib/contractor-portal.js';
import { getDb } from '../../../../lib/db.js';
import { getCurrentTenantId, getRequestIp } from '../../../../lib/tenant.js';

// EPIC-G contractor portal (FR-G-8, master spec §G.5): a contractor advances their
// assigned ticket WITHOUT signing in. The magic-link token IS the authorisation —
// there is no staff session here — so the action re-verifies it on every call
// (stateless), then binds it to the ticket's CURRENT assignee before any write:
//
//  1. verify the signed token → the attested { repairRequestId, contractorId };
//  2. resolve the tenant from the request host (EPIC-S middleware) and load the
//     ticket inside the tenant (RLS) scope — a cross-tenant id simply looks unknown;
//  3. the ticket's `assignedContractorId` MUST equal the token's contractor (so a
//     stale link stops working the moment the ticket is reassigned);
//  4. the target is DERIVED server-side from the current status (contractorNextStep)
//     — the contractor cannot pick an arbitrary status, only their next forward step.
//
// The transition writes the status-history row (actor is the contractor, no staff
// user) and an audit row (actor `contractor:<id>`), in one tenant transaction (G4).

interface ContractorAdvanceClient extends AuditWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; status: string; assignedContractorId: string | null } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  repairStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a contractor advance, consumed by `useActionState`. */
export interface ContractorAdvanceState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): ContractorAdvanceState {
  return { ok: false, errors: [{ message }] };
}

export async function advanceRepairAsContractor(
  _prevState: ContractorAdvanceState,
  formData: FormData,
): Promise<ContractorAdvanceState> {
  const tokenValue = formData.get('token');
  const verified =
    typeof tokenValue === 'string'
      ? verifyContractorLink(tokenValue, contractorLinkSecret(), Date.now())
      : null;
  if (verified === null) {
    return deny('This link is invalid or has expired.');
  }

  const { repairRequestId, contractorId } = verified;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: ContractorAdvanceState = deny('This repair could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ContractorAdvanceClient;
    const ticket = await tx.repairRequest.findFirst({ where: { id: repairRequestId } });
    if (!ticket) {
      return; // result stays the not-found default
    }
    if (ticket.assignedContractorId !== contractorId) {
      result = deny('This link is no longer assigned to you.');
      return;
    }
    const step = contractorNextStep(ticket.status);
    if (step === null) {
      result = deny('There is nothing to update on this repair right now.');
      return;
    }

    const from = ticket.status;
    await tx.repairRequest.update({ where: { id: repairRequestId }, data: { status: step.to } });
    await tx.repairStatusEvent.create({
      data: {
        tenantId,
        repairRequestId,
        fromStatus: from,
        toStatus: step.to,
        actorUserId: null,
        notes: 'Updated by the contractor',
      },
    });
    await audit(tx, {
      tenantId,
      actor: `contractor:${contractorId}`,
      action: 'repair_request.status_changed',
      entity: 'repair_request',
      entityId: repairRequestId,
      diff: { status: { from, to: step.to } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
