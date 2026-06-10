'use server';

import { marketStatusUpdateSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-H property management (FR-H-2, master spec §J.3): a staff member changes a
// listing's market status. RBAC-gated on `property.write` (fail-closed before any
// read/write). The spec lists the statuses but imposes no restrictive transition
// allow-list, so any value is accepted; the change is recorded both in an
// `audit_logs` row AND an append-only `property_status_events` timeline row (the
// basis for the days-on-market metric, §I.5/§J.3), inside the same tenant transaction
// (G4). Drives a form via `useActionState`.

interface MarketStatusClient extends AuditWriter {
  property: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; marketStatus: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  propertyStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a market-status change, consumed by `useActionState`. */
export interface MarketStatusState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function setPropertyMarketStatus(
  _prevState: MarketStatusState,
  formData: FormData,
): Promise<MarketStatusState> {
  const parsed = marketStatusUpdateSchema.safeParse({
    id: field(formData, 'id'),
    marketStatus: field(formData, 'marketStatus'),
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
    await requireStaffPermission('property.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to edit listings.' }] };
  }

  const { id, marketStatus } = parsed.data;
  const actor = await getStaffActor();
  const changedByAgentId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: MarketStatusState = { ok: false, errors: [{ message: 'Property not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as MarketStatusClient;
    const existing = await tx.property.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const from = existing.marketStatus;
    if (from === marketStatus) {
      result = { ok: true }; // no-op — nothing changed, no event
      return;
    }
    await tx.property.update({ where: { id }, data: { marketStatus } });
    await tx.propertyStatusEvent.create({
      data: {
        tenantId,
        propertyId: id,
        fromStatus: from,
        toStatus: marketStatus,
        changedByAgentId,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.status_changed',
      entity: 'property',
      entityId: id,
      diff: { marketStatus: { from, to: marketStatus } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
