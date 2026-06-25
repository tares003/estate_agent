import { headers } from 'next/headers';
import { runWithAuthTenant } from '@estate/db';

import { getAuth } from './auth.js';
import { getCurrentTenantId } from './tenant.js';

// EPIC-T FR-T-3 — the customer sign-in seam. Authenticates a `type=customer`
// user with email + password via better-auth's signInEmail (which verifies the
// credential against the stored hash, FR-N-1). signInEmail runs inside
// runWithAuthTenant(<tenant>) so the BYPASSRLS auth adapter scopes the user
// lookup to the request's tenant (identity is per-tenant — the same email may
// exist once per tenant), and the request headers are forwarded so better-auth's
// nextCookies plugin (auth.ts) writes the freshly-minted session cookie into the
// Server Action's response.
//
// Returns a small, audit-friendly result; the sign-in action owns the audit
// write. Every failure (auth disabled, wrong email/password, or any other
// sign-in error) maps to a fail-closed `{ ok: false }` so the action can show ONE
// generic message — it must never disclose which half of the credential was
// wrong (account-enumeration defence).
//
// Connection/config glue (reads the auth instance / the session adapter / the
// request cookies) — excluded from unit coverage exactly like the registration
// seam; the action mocks it, and the live sign-in flow is covered by the
// Testcontainers integration tests.

/** Input for {@link signInCustomer}. */
export interface SignInCustomerInput {
  email: string;
  password: string;
}

/** The result of a sign-in attempt. */
export type SignInCustomerResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unavailable' | 'invalid_credentials' | 'failed' };

/**
 * Authenticate a customer. Returns `{ ok: true, userId }` and sets the session
 * cookie on success, or a fail-closed `{ ok: false, reason }` (auth disabled,
 * rejected credential, or any other sign-in failure) — the action treats every
 * failure as a denied sign-in and reveals nothing about the cause.
 */
export async function signInCustomer(input: SignInCustomerInput): Promise<SignInCustomerResult> {
  const auth = getAuth();
  if (!auth) return { ok: false, reason: 'unavailable' };

  const tenantId = await getCurrentTenantId();
  const requestHeaders = await headers();
  const body = {
    email: input.email,
    password: input.password,
  };
  type SignInArg = Parameters<typeof auth.api.signInEmail>[0];
  try {
    const result = await runWithAuthTenant(tenantId, () =>
      auth.api.signInEmail({ body, headers: requestHeaders } as unknown as SignInArg),
    );
    // signInEmail returns `{ token, user, ... }`; the user id is the account.
    const user = (result as { user?: { id?: string } } | null)?.user;
    if (!user?.id) return { ok: false, reason: 'invalid_credentials' };
    return { ok: true, userId: user.id };
  } catch (error) {
    // better-auth throws an APIError with a 401 (UNAUTHORIZED) body when the
    // email is unknown or the password does not match. Both collapse to the SAME
    // generic reason so the caller cannot distinguish a bad email from a bad
    // password (account-enumeration defence).
    const status = (error as { status?: unknown } | null)?.status;
    if (status === 'UNAUTHORIZED' || status === 401) {
      return { ok: false, reason: 'invalid_credentials' };
    }
    return { ok: false, reason: 'failed' };
  }
}
