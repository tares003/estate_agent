'use server';

import { passwordResetRequestSchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { requestPasswordReset } from '../../lib/password-reset.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { FORGOT_PASSWORD_CONSENT_TEXT } from './consent-text.js';

// EPIC-N FR-N-5 — the password-reset REQUEST submission (`/forgot-password`). A
// PUBLIC form, held to the compliance gates: G5 (the schema carries `gdpr_consent`;
// the agreed text is persisted verbatim), Turnstile verified BEFORE any side effect
// (CLAUDE.md §9). It asks better-auth to mint an opaque, single-use reset token via
// the requestPasswordReset seam (which queues the per-tenant reset email), then
// records consent + an audit row in ONE tenant transaction (G4).
//
// PRIVACY — no account enumeration. The action ALWAYS returns the same neutral
// success, whether or not the email matches an account, so the form never reveals
// which addresses are registered. The audit diff records only that a reset was
// requested — never the email address itself (the consent row carries the subject,
// which is the lawful record of who asked).

interface ForgotPasswordWriteClient extends ConsentWriter, AuditWriter {}

/** The result of a reset-request submission, consumed by `useActionState`. */
export interface ForgotPasswordFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitForgotPassword(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: field(formData, 'email'),
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

  const { email } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  // Anti-spam gate (CLAUDE.md §9): verify the Turnstile token BEFORE any side effect.
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

  // Ask better-auth to mint + email the reset link. Resolves whether or not the
  // address is registered (no enumeration), so it never throws here.
  await requestPasswordReset({ email });

  // Record the consent + an audit row in ONE tenant transaction (G4/G5). The audit
  // diff deliberately omits the email (no PII leak); the consent row carries the
  // subject as the lawful record of who requested the reset.
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ForgotPasswordWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'password_reset_request',
      subject: email,
      consentText: FORGOT_PASSWORD_CONSENT_TEXT,
      ipAddress: ip,
    });
    await audit(tx, {
      tenantId,
      actor: 'anonymous',
      action: 'auth.password_reset_requested',
      entity: 'user',
      diff: { requested: true },
      ip,
    });
  });

  return { ok: true };
}
