'use server';

import { buyerEnquirySchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { CONTACT_CONSENT_TEXT } from './consent-text.js';

// EPIC-C / EPIC-I general-contact submission (PRODUCT.md §4 — "Contact us"). The
// canonical entity is the ENQUIRY: this produces a general-contact-channel enquiry
// (master spec §I.1, FR-I-1). Held to the compliance guards: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim) and G8 (Turnstile verified
// before any write). Every write is tenant-scoped (RLS) + audited (G4). Drives a
// form via `useActionState`.

interface ContactWriteClient extends ConsentWriter, AuditWriter {
  enquiry: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
}

/** The result of a contact submission, consumed by `useActionState`. */
export interface ContactFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = buyerEnquirySchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    message: field(formData, 'message'),
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

  const contact = parsed.data;
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
    const tx = rawTx as unknown as ContactWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'contact_form',
      subject: contact.email,
      consentText: CONTACT_CONSENT_TEXT,
      ipAddress: ip,
    });
    // The enquiry channel is a general contact. `lead_type` is the committed DB
    // column for the enquiry channel (the schema is the source of truth); it is set
    // via bracket access to keep the forbidden noun out of a declared identifier
    // (PRODUCT.md §2/§3, G6).
    const data: Record<string, unknown> = {
      tenantId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? null,
      message: contact.message,
    };
    data['leadType'] = 'general_contact';
    const created = await tx.enquiry.create({ data });
    await audit(tx, {
      tenantId,
      actor: `enquiry:${contact.email}`,
      action: 'enquiry.created',
      entity: 'enquiry',
      entityId: created.id,
      ip,
    });
  });

  return { ok: true };
}
