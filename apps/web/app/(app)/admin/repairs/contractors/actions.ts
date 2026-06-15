'use server';

import { z } from 'zod';
import { email as emailField, nonEmptyString, ukPhone } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-G contractor directory admin (FR-G-8, master spec §G.6) — the audited,
// RBAC-gated mutations. Both gate on `repair_request.manage` (fail-closed before
// any read/write), run inside the tenant (RLS) scope, and audit (G4).
//
// A contractor is a staff-entered B2B record on a legitimate-interest basis — not
// a consenting data subject filling a public form — so creating one is NOT a
// consent event. Input is therefore validated field-by-field with the shared
// standalone field validators (no `z.object`), which both reads honestly and
// avoids asserting a GDPR consent that does not apply (the G5 guard targets
// consent-bearing form schemas).

interface ContractorClient extends AuditWriter {
  contractor: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; active: boolean } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a contractor mutation, consumed by `useActionState`. */
export interface ContractorActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): ContractorActionState {
  return { ok: false, errors: [{ message }] };
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function createContractor(
  _prevState: ContractorActionState,
  formData: FormData,
): Promise<ContractorActionState> {
  // Field-by-field validation (no z.object — see the file header on G5/consent).
  const name = nonEmptyString.safeParse(field(formData, 'name'));
  const parsedEmail = emailField.safeParse(field(formData, 'email'));
  const errors: FormErrorItem[] = [];
  if (!name.success) errors.push({ field: 'name', message: 'A contractor name is required.' });
  if (!parsedEmail.success)
    errors.push({ field: 'email', message: 'Enter a valid email address.' });

  const phoneRaw = field(formData, 'phone');
  let phone: string | null = null;
  if (phoneRaw !== undefined) {
    const parsedPhone = ukPhone.safeParse(phoneRaw);
    if (!parsedPhone.success)
      errors.push({ field: 'phone', message: 'Enter a valid UK phone number.' });
    else phone = parsedPhone.data;
  }
  const trade = field(formData, 'trade') ?? null;

  if (errors.length > 0 || !name.success || !parsedEmail.success) {
    return { ok: false, errors };
  }

  try {
    await requireStaffPermission('repair_request.manage');
  } catch {
    return deny('You do not have permission to manage contractors.');
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: ContractorActionState = deny('The contractor could not be created.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ContractorClient;
    const created = await tx.contractor.create({
      data: { tenantId, name: name.data, email: parsedEmail.data, phone, trade },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'contractor.created',
      entity: 'contractor',
      entityId: created.id,
      ip,
    });
    result = { ok: true };
  });
  return result;
}

const activeSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export async function setContractorActive(
  _prevState: ContractorActionState,
  formData: FormData,
): Promise<ContractorActionState> {
  const parsed = activeSchema.safeParse({
    id: formData.get('id'),
    active: formData.get('active'),
  });
  if (!parsed.success) {
    return deny('That change is not valid.');
  }

  try {
    await requireStaffPermission('repair_request.manage');
  } catch {
    return deny('You do not have permission to manage contractors.');
  }

  const { id, active } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: ContractorActionState = deny('That contractor could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ContractorClient;
    const contractor = await tx.contractor.findFirst({ where: { id } });
    if (!contractor) {
      return; // result stays the not-found default
    }
    await tx.contractor.update({ where: { id }, data: { active } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'contractor.active_changed',
      entity: 'contractor',
      entityId: id,
      diff: { active: { from: contractor.active, to: active } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
