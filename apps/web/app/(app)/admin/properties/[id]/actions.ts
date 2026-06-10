'use server';

import { propertyUpdateSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-H property management (FR-H-2): a staff member edits a listing's core details.
// RBAC-gated on `property.write` (fail-closed before any read/write); the change is
// recorded in an `audit_logs` row in the same tenant-scoped transaction (G4). Price
// is captured in pounds and stored as pence. Market status + publish are separate
// controls. Drives a form via `useActionState`.

interface PropertyWriteClient extends AuditWriter {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a property edit, consumed by `useActionState`. */
export interface PropertyEditState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function numberField(formData: FormData, name: string): number | undefined {
  const value = field(formData, name);
  return value === undefined ? undefined : Number(value);
}

export async function updateProperty(
  _prevState: PropertyEditState,
  formData: FormData,
): Promise<PropertyEditState> {
  const parsed = propertyUpdateSchema.safeParse({
    id: field(formData, 'id'),
    title: field(formData, 'title'),
    displayAddress: field(formData, 'displayAddress'),
    postcode: field(formData, 'postcode'),
    price: numberField(formData, 'price'),
    bedrooms: numberField(formData, 'bedrooms'),
    bathrooms: numberField(formData, 'bathrooms'),
    receptions: numberField(formData, 'receptions'),
    description: field(formData, 'description'),
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

  const update = parsed.data;
  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: PropertyEditState = { ok: false, errors: [{ message: 'Property not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PropertyWriteClient;
    const existing = await tx.property.findFirst({ where: { id: update.id, deletedAt: null } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const data: Record<string, unknown> = {
      displayAddress: update.displayAddress,
      postcode: update.postcode,
      title: update.title ?? null,
      description: update.description ?? null,
      price: update.price != null ? update.price * 100 : null,
      bedrooms: update.bedrooms ?? null,
      bathrooms: update.bathrooms ?? null,
      receptions: update.receptions ?? null,
    };
    await tx.property.update({ where: { id: update.id }, data });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property.updated',
      entity: 'property',
      entityId: update.id,
      diff: { to: data },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
