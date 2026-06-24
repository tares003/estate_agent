'use server';

import { passwordResetSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { resetPassword } from '../../lib/password-reset.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-N FR-N-5 — the password-reset CONSUME submission (`/reset-password`). The
// visitor sets a NEW password, carrying the opaque, single-use token from the email.
// It captures NO new personal data (only a secret + the opaque token), so no GDPR
// consent / Turnstile gate applies — the token itself is the authorisation. It
// delegates to the resetPassword seam (better-auth verifies the token has not
// expired — 60-min window — deletes it on use so it cannot be replayed, and
// re-hashes the password FR-N-1), then writes an audit row in a tenant transaction
// (G4). Fail-closed: an invalid form or a rejected/expired token writes nothing.
//
// The audit diff NEVER carries the new password (no secret leak).

/** The result of a reset submission, consumed by `useActionState`. */
export interface ResetPasswordFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

export async function submitResetPassword(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const tokenValue = formData.get('token');
  const parsed = passwordResetSchema.safeParse({
    token: typeof tokenValue === 'string' ? tokenValue.trim() : undefined,
    // Password is intentionally read raw (NOT trimmed) — surrounding spaces are
    // legitimate in a passphrase.
    password: typeof formData.get('password') === 'string' ? formData.get('password') : undefined,
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

  const { token, password } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  // Consume the token (verifies + expires it, re-hashes the password). Fail-closed:
  // an invalid/expired token (or auth disabled) denies the reset and writes nothing.
  const result = await resetPassword({ token, password });
  if (!result.ok) {
    const message =
      result.reason === 'invalid_token'
        ? 'This reset link has expired or already been used. Request a new one.'
        : 'We couldn’t reset your password just now. Please try again.';
    return { ok: false, errors: [{ message }] };
  }

  // Audit the successful reset (G4). The diff records only that the password was
  // reset — never the new password itself.
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as AuditWriter;
    await audit(tx, {
      tenantId,
      actor: result.userId ? `customer:${result.userId}` : 'anonymous',
      action: 'auth.password_reset_completed',
      entity: 'user',
      entityId: result.userId,
      diff: { passwordReset: true },
      ip,
    });
  });

  return { ok: true };
}
