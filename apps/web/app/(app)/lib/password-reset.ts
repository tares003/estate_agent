import { runWithAuthTenant } from '@estate/db';

import { getAuth } from './auth.js';
import { getCurrentTenantId, getRequestOrigin } from './tenant.js';

// EPIC-N FR-N-5 — the password-reset seams. Two thin wrappers over better-auth's
// emailAndPassword reset endpoints, mirroring the customer-register seam exactly:
//
//   - requestPasswordReset: asks better-auth to mint an opaque, single-use reset
//     token (a `verification` row) and email the reset link via the wired
//     sendResetPassword callback (auth.ts → per-tenant SMTP). better-auth returns
//     success WHETHER OR NOT the email matches an account, so this seam never
//     reveals which addresses are registered (account-enumeration safe).
//
//   - resetPassword: consumes the token with the new password. better-auth
//     verifies the token has not expired (60-min window, FR-N-5) and deletes the
//     `verification` row on use (single-use), then re-hashes the password (FR-N-1).
//
// Both run inside runWithAuthTenant(<tenant>) so the BYPASSRLS auth adapter scopes
// the work to the request's tenant (identity is per-tenant). They return small,
// audit-friendly results; the form actions own the consent + audit writes.
//
// Connection/config glue (reads env / the auth DB / the request origin) — excluded
// from unit coverage exactly like the customer-register seam; the form actions mock
// it, and the live reset flow is covered by the Testcontainers integration tests.

/** Input for {@link requestPasswordReset}. */
export interface RequestPasswordResetInput {
  email: string;
}

/** Input for {@link resetPassword}. */
export interface ResetPasswordInput {
  /** The opaque token from the reset email. */
  token: string;
  /** The new password (validated upstream; better-auth hashes it). */
  password: string;
}

/** The result of consuming a reset token. */
export type ResetPasswordResult =
  | { ok: true; userId: string | null }
  | { ok: false; reason: 'unavailable' | 'invalid_token' | 'failed' };

/**
 * Ask better-auth to email a reset link for the given address. Resolves whether or
 * not the address is registered (no enumeration); resolves silently to `undefined`
 * when auth is not configured (the form still shows the neutral success state).
 */
export async function requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
  const auth = getAuth();
  if (!auth) return;
  const tenantId = await getCurrentTenantId();
  const origin = await getRequestOrigin();
  // The page the reset link lands on; better-auth appends `?token=<token>`.
  const redirectTo = `${origin}/reset-password`;
  try {
    await runWithAuthTenant(tenantId, () =>
      auth.api.requestPasswordReset({ body: { email: input.email, redirectTo } }),
    );
  } catch {
    // Fail soft — never surface whether the address exists or the send failed; the
    // action returns the same neutral success regardless (no enumeration).
  }
}

/**
 * Consume a reset token, setting the new password. Returns `{ ok: true, userId }`
 * on success, or a fail-closed `{ ok: false, reason }` (auth disabled, an invalid /
 * expired token, or any other failure) — the action treats every failure as a
 * denied reset and writes nothing.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  const auth = getAuth();
  if (!auth) return { ok: false, reason: 'unavailable' };
  const tenantId = await getCurrentTenantId();
  try {
    const result = await runWithAuthTenant(tenantId, () =>
      auth.api.resetPassword({ body: { token: input.token, newPassword: input.password } }),
    );
    // resetPassword returns `{ status: boolean }`; the user id is not surfaced, so
    // the audit entity id is best-effort (null when better-auth does not return it).
    const status = (result as { status?: unknown } | null)?.status;
    if (status !== true) return { ok: false, reason: 'failed' };
    const userId = (result as { user?: { id?: string } } | null)?.user?.id ?? null;
    return { ok: true, userId };
  } catch (error) {
    // better-auth throws a BAD_REQUEST APIError when the token is missing, invalid
    // or expired; map it so the form can show "this link has expired" without
    // leaking a stack trace.
    const status = (error as { status?: unknown } | null)?.status;
    if (status === 'BAD_REQUEST' || status === 400) {
      return { ok: false, reason: 'invalid_token' };
    }
    return { ok: false, reason: 'failed' };
  }
}
