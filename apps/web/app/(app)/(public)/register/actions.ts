'use server';

import { customerRegistrationSchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { registerCustomer } from '../../lib/customer-register.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { REGISTER_CONSENT_TEXT } from './consent-text.js';

// EPIC-T FR-T-1 — the customer-registration submission (`/register`). A PUBLIC
// form, held to the compliance gates: G5 (the schema carries `gdpr_consent`; the
// agreed text is persisted verbatim), Turnstile verified BEFORE any write
// (CLAUDE.md §9). It creates a `type=customer` user via the registerCustomer seam
// (better-auth signUpEmail → password hashed FR-N-1 → email-verification magic
// link sent automatically), then records consent + an audit row in ONE tenant
// transaction (G4). Fail-closed: an invalid form, a failed challenge, or a failed
// sign-up writes nothing. Drives a form via `useActionState`.

interface RegisterWriteClient extends ConsentWriter, AuditWriter {}

/** The result of a registration submission, consumed by `useActionState`. */
export interface RegisterFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitRegister(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const parsed = customerRegistrationSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    // Password is intentionally read raw (NOT trimmed) — surrounding spaces are
    // legitimate in a passphrase.
    password: typeof formData.get('password') === 'string' ? formData.get('password') : undefined,
    gdpr_consent: formData.get('gdpr_consent') === 'on',
    marketingOptIn: formData.get('marketingOptIn') === 'on',
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

  const registration = parsed.data;
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

  // Create the customer account (and trigger the verification email) before the
  // consent/audit write, so a failed sign-up leaves no orphaned consent row.
  const created = await registerCustomer({
    name: registration.name,
    email: registration.email,
    password: registration.password,
    marketingOptIn: registration.marketingOptIn,
  });
  if (!created.ok) {
    const message =
      created.reason === 'email_taken'
        ? 'An account with that email already exists — try signing in instead.'
        : 'We couldn’t create your account just now. Please try again.';
    return { ok: false, errors: [{ message }] };
  }

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RegisterWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'customer_registration',
      subject: registration.email,
      consentText: REGISTER_CONSENT_TEXT,
      ipAddress: ip,
    });
    await audit(tx, {
      tenantId,
      actor: `customer:${created.userId}`,
      action: 'customer.registered',
      entity: 'user',
      entityId: created.userId,
      diff: { email: registration.email, marketingOptIn: registration.marketingOptIn },
      ip,
    });
  });

  return { ok: true };
}
