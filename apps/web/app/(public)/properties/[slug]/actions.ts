'use server';

import { buyerEnquirySchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';
import { getDb } from '../../../lib/db.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import { ENQUIRY_CONSENT_TEXT } from './consent-text.js';

/**
 * The slice of the tenant-scoped Prisma client this action writes through.
 * `withTenant` hands the callback a deliberately minimal structural client, so
 * we widen it to the write surfaces actually used: the consent + audit helpers'
 * structural inputs, plus the `enquiry.create` delegate. RLS still constrains
 * every write to the current tenant.
 */
interface EnquiryWriteClient extends ConsentWriter, AuditWriter {
  enquiry: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
}

/**
 * EPIC-F / EPIC-I buyer-enquiry submission (PRODUCT.md §4 — "Contact agent";
 * canonical entity is the ENQUIRY). Drives the property-detail enquiry form via
 * `useActionState`, so it takes `(prevState, formData)` and returns the next
 * state.
 *
 * Personal data is captured, so the action is held to the two compliance guards
 * on real code:
 *   - G5 (GDPR consent): the form schema carries `gdpr_consent`, and the agreed
 *     affirmation is persisted verbatim through `recordConsent(...)`.
 *   - G4 (audit-log coverage): the state-changing `enquiry.create` is paired with
 *     an `audit(...)` row in the same tenant-scoped transaction.
 */

/** The result of an enquiry submission, consumed by `useActionState`. */
export interface EnquiryFormState {
  /** True once the enquiry has been persisted. */
  ok: boolean;
  /** Field-linked validation messages to surface in the form-level summary. */
  errors?: FormErrorItem[];
}

/** Read a string field from the submitted form, trimming and nulling blanks. */
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitEnquiry(
  _prevState: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  const parsed = buyerEnquirySchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    message: field(formData, 'message'),
    propertyId: field(formData, 'propertyId'),
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

  const enquiry = parsed.data;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  // Anti-spam gate: verify the Cloudflare Turnstile token BEFORE any write
  // (CLAUDE.md §9). On failure nothing is persisted — no consent, enquiry or
  // audit row — and the form shows a retry-the-challenge error.
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
    const tx = rawTx as unknown as EnquiryWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'enquiry_form',
      subject: enquiry.email,
      consentText: ENQUIRY_CONSENT_TEXT,
      ipAddress: ip,
    });
    // `leadType` defaults to `buyer_enquiry` at the database layer, so it is not
    // set here — this is the buyer-enquiry surface, and the default keeps the
    // forbidden 'lead' noun out of application code (PRODUCT.md §2/§3, G6).
    const created = await tx.enquiry.create({
      data: {
        tenantId,
        propertyId: enquiry.propertyId ?? null,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone ?? null,
        message: enquiry.message,
      },
    });
    await audit(tx, {
      tenantId,
      actor: `enquiry:${enquiry.email}`,
      action: 'enquiry.created',
      entity: 'enquiry',
      entityId: created.id,
      ip,
    });
  });

  return { ok: true };
}
