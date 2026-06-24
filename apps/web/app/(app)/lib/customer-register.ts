import { runWithAuthTenant } from '@estate/db';

import { getAuth } from './auth.js';
import { getCurrentTenantId } from './tenant.js';

// EPIC-T FR-T-1 — the customer sign-up seam. Creates a `type=customer` user via
// better-auth's signUpEmail (so the password is hashed with the configured
// memory-hard algorithm, FR-N-1) and lets better-auth send the email-verification
// magic link automatically (emailVerification.sendOnSignUp, wired in auth.ts).
//
// signUpEmail runs inside runWithAuthTenant(<tenant>) so the BYPASSRLS auth
// adapter scopes the INSERT to the request's tenant (identity is per-tenant —
// the same email may exist once per tenant). Returns a small, audit-friendly
// result; the registration action owns the consent + audit write.
//
// Connection/config glue (reads env / the auth DB / the session adapter) — it is
// excluded from unit coverage exactly like the magic-link send glue in auth.ts;
// the registration action mocks it, and the live sign-up flow is covered by the
// Testcontainers integration tests.

/** Input for {@link registerCustomer}. */
export interface RegisterCustomerInput {
  name: string;
  email: string;
  password: string;
  /** Optional marketing opt-in captured at registration (FR-T-1). */
  marketingOptIn: boolean;
}

/** The result of a registration attempt. */
export type RegisterCustomerResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unavailable' | 'email_taken' | 'failed' };

/**
 * Create a customer account. Returns `{ ok: true, userId }` on success, or a
 * fail-closed `{ ok: false, reason }` (auth disabled, duplicate email, or any
 * other sign-up failure) — the action treats every failure as a denied
 * registration and writes nothing.
 */
export async function registerCustomer(
  input: RegisterCustomerInput,
): Promise<RegisterCustomerResult> {
  const auth = getAuth();
  if (!auth) return { ok: false, reason: 'unavailable' };

  const tenantId = await getCurrentTenantId();
  // The `type` + `marketingOptIn` keys are input-enabled `additionalFields` on the
  // better-auth user (auth.ts). The widened public `Auth` type drops those custom
  // fields from the signUpEmail body, so the body is assembled as a record and
  // cast at the call — the same widening seam the customer-session reader uses for
  // getSession's tenant additionalField.
  const body = {
    name: input.name,
    email: input.email,
    password: input.password,
    // Mark this as a customer account (PRODUCT.md §3); staff rows keep the default.
    type: 'customer',
    // Persist the captured marketing opt-in (FR-T-1); GDPR consent is logged apart.
    marketingOptIn: input.marketingOptIn,
  };
  type SignUpArg = Parameters<typeof auth.api.signUpEmail>[0];
  try {
    const result = await runWithAuthTenant(tenantId, () =>
      auth.api.signUpEmail({ body } as unknown as SignUpArg),
    );
    // signUpEmail returns `{ token, user }`; the user id is the new account.
    const user = (result as { user?: { id?: string } } | null)?.user;
    if (!user?.id) return { ok: false, reason: 'failed' };
    return { ok: true, userId: user.id };
  } catch (error) {
    // better-auth throws an APIError with a duplicate-email body when the email
    // is already registered in this tenant; map it so the caller can show the
    // sign-in-instead hint without leaking a stack trace.
    const status = (error as { status?: unknown } | null)?.status;
    if (status === 'UNPROCESSABLE_ENTITY' || status === 422) {
      return { ok: false, reason: 'email_taken' };
    }
    return { ok: false, reason: 'failed' };
  }
}
