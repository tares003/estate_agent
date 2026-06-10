'use server';

import { repairRequestSchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { REPAIR_CONSENT_TEXT } from './consent-text.js';

// EPIC-G tenant repair-report submission (PRODUCT.md §4 — "Report a repair" /
// repair_request, FR-G-1). Writes a tenant-scoped RepairRequest at intake; staff
// triage urgency + resolve the property in the admin inbox (a later slice), so
// `propertyId` is left null and the typed `propertyReference` is stored as the
// free-text `reference`. The repair flow is in the `core` pack (every tenant), so
// no entitlement gate. Held to the two compliance guards: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim) and G8 (the anti-spam
// challenge is verified before any write). Every write is tenant-scoped (RLS) +
// audited (G4). Drives a form via `useActionState`.

interface RepairWriteClient extends ConsentWriter, AuditWriter {
  repairRequest: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
}

/** The result of a repair submission, consumed by `useActionState`. */
export interface RepairFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitRepairRequest(
  _prevState: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const parsed = repairRequestSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    propertyReference: field(formData, 'propertyReference'),
    category: field(formData, 'category'),
    description: field(formData, 'description'),
    urgency: field(formData, 'urgency'),
    gdpr_consent: formData.get('gdpr_consent') === 'on',
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

  const repair = parsed.data;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  // Anti-spam gate (CLAUDE.md §9): verify the Turnstile token BEFORE any write.
  const turnstileToken = formData.get('cf-turnstile-response');
  const challengePassed = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : null,
    ip,
  );
  if (!challengePassed) {
    return {
      ok: false,
      errors: [{ message: 'We couldn’t verify the security challenge. Please try again.' }],
    };
  }

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'repair_form',
      subject: repair.email,
      consentText: REPAIR_CONSENT_TEXT,
      ipAddress: ip,
    });
    const created = await tx.repairRequest.create({
      data: {
        tenantId,
        name: repair.name,
        email: repair.email,
        phone: repair.phone,
        // The tenant types a free-text property reference at intake; staff resolve
        // it to a catalogue `propertyId` in the admin inbox later.
        reference: repair.propertyReference,
        category: repair.category,
        description: repair.description,
        urgency: repair.urgency,
      },
    });
    await audit(tx, {
      tenantId,
      actor: `repair_request:${repair.email}`,
      action: 'repair_request.created',
      entity: 'repair_request',
      entityId: created.id,
      ip,
    });
  });

  return { ok: true };
}
