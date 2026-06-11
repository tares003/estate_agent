'use server';

import { repairRequestSchema } from '@estate/validators';
import {
  audit,
  notify,
  recordConsent,
  withTenant,
  type AuditWriter,
  type ConsentWriter,
  type NotificationWriter,
} from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { repairReference } from '../../lib/repair-reference.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { REPAIR_CONSENT_TEXT } from './consent-text.js';

// EPIC-G tenant repair-report submission (PRODUCT.md §4 — "Report a repair" /
// repair_request, FR-G-1/FR-G-3). Writes a tenant-scoped RepairRequest at intake,
// assigning the §G.1 human-readable ticket reference (per-tenant sequential,
// RPR-YYYY-NNNNN; the per-tenant unique constraint backstops a concurrency race —
// the transaction is retried once on collision). The tenant confirmation email is
// QUEUED via notify() in the same transaction (§H.13 — the action records intent;
// the workers dispatch). Staff triage urgency + resolve the property in the admin
// inbox, so `propertyId` is left null and the typed `propertyReference` is stored
// alongside. The repair flow is in the `core` pack (every tenant), so no
// entitlement gate. Held to the two compliance guards: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim) and G8 (the anti-spam
// challenge is verified before any write). Every write is tenant-scoped (RLS) +
// audited (G4). Drives a form via `useActionState`.

interface RepairWriteClient extends ConsentWriter, AuditWriter, NotificationWriter {
  repairRequest: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    count(args: Record<string, unknown>): Promise<number>;
  };
}

/** The result of a repair submission, consumed by `useActionState`. */
export interface RepairFormState {
  ok: boolean;
  /** The §G.1 ticket reference, set on success (shown on the success panel). */
  reference?: string;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
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

  const submit = (): Promise<string> =>
    withTenant(getDb(), tenantId, async (rawTx) => {
      const tx = rawTx as unknown as RepairWriteClient;
      await recordConsent(tx, {
        tenantId,
        scope: 'repair_form',
        subject: repair.email,
        consentText: REPAIR_CONSENT_TEXT,
        ipAddress: ip,
      });
      // The next per-tenant sequence number (RLS scopes the count to the tenant);
      // the per-tenant unique constraint catches a concurrent duplicate.
      const sequence = (await tx.repairRequest.count({})) + 1;
      const reference = repairReference(new Date(), sequence);
      const created = await tx.repairRequest.create({
        data: {
          tenantId,
          reference,
          name: repair.name,
          email: repair.email,
          phone: repair.phone,
          propertyReference: repair.propertyReference,
          category: repair.category,
          description: repair.description,
          urgency: repair.urgency,
        },
      });
      // FR-G-3: the tenant confirmation is queued in the same transaction; the
      // worker renders + dispatches it (§H.13 — record intent, never send inline).
      await notify(tx, {
        tenantId,
        event: 'repair_request.received',
        channel: 'email',
        recipient: repair.email,
        payload: {
          reference,
          name: repair.name,
          category: repair.category,
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
      return reference;
    });

  let reference: string;
  try {
    reference = await submit();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A concurrent submission took the same sequence number — retry once.
    reference = await submit();
  }

  return { ok: true, reference };
}
