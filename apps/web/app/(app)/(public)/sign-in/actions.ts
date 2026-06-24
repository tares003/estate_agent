'use server';

import { customerSignInSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { signInCustomer } from '../../lib/customer-sign-in.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-T FR-T-3 — the customer sign-in submission (`/sign-in`). A registered
// customer authenticates with email + password and is returned to the route they
// were trying to reach (`?next=`). Mirrors the registration action's shape: the
// Zod schema validates the input, then the `signInCustomer` seam (better-auth
// signInEmail → password verified FR-N-1 → session cookie set via nextCookies)
// authenticates. On success the action emits a `customer.signed_in` audit row in
// ONE tenant transaction (G4 — a sign-in mints a session row, a state change) and
// returns the SANITISED redirect target for the client to navigate to. Drives a
// form via `useActionState`.
//
// Fail-closed: invalid input, or a rejected credential, authenticates nothing and
// writes nothing, and the surfaced error is deliberately GENERIC — it never
// discloses whether the email or the password was wrong (account-enumeration
// defence), so it carries no field link.

/** The default post-sign-in destination (design brief — `/account` dashboard). */
const DEFAULT_REDIRECT = '/account';

/** The result of a sign-in submission, consumed by `useActionState`. */
export interface SignInFormState {
  ok: boolean;
  errors?: FormErrorItem[];
  /** Where the client should navigate after a successful sign-in (FR-T-3). */
  redirectTo?: string;
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Reduce a requested `?next=` to a SAFE same-origin destination, or the default
 * dashboard. Only an absolute path beginning with a single `/` is honoured: this
 * rejects an absolute URL (`https://evil…`), a protocol-relative URL
 * (`//evil…`), and a backslash-smuggled variant (`/\evil…`, which some browsers
 * treat as protocol-relative) — closing the open-redirect that a crafted sign-in
 * link would otherwise exploit.
 */
function sanitiseNext(next: string | undefined): string {
  if (!next) return DEFAULT_REDIRECT;
  if (!next.startsWith('/')) return DEFAULT_REDIRECT;
  // `//` or `/\` are treated as protocol-relative by browsers — reject both.
  if (next.startsWith('//') || next.startsWith('/\\')) return DEFAULT_REDIRECT;
  return next;
}

export async function submitSignIn(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const redirectTo = sanitiseNext(field(formData, 'next'));

  const parsed = customerSignInSchema.safeParse({
    email: field(formData, 'email'),
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

  const credentials = parsed.data;
  const tenantId = await getCurrentTenantId();

  // Authenticate (and set the session cookie) BEFORE the audit write, so a
  // rejected credential leaves no orphaned audit row.
  const signedIn = await signInCustomer({
    email: credentials.email,
    password: credentials.password,
  });
  if (!signedIn.ok) {
    // ONE generic message regardless of cause — never disclose which half of the
    // credential was wrong (account-enumeration defence).
    return {
      ok: false,
      errors: [{ message: 'Email or password is incorrect. Please try again.' }],
    };
  }

  const ip = await getRequestIp();
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as AuditWriter;
    await audit(tx, {
      tenantId,
      actor: `customer:${signedIn.userId}`,
      action: 'customer.signed_in',
      entity: 'user',
      entityId: signedIn.userId,
      diff: { email: credentials.email },
      ip,
    });
  });

  return { ok: true, redirectTo };
}
