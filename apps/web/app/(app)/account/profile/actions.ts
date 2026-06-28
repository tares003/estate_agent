'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { customerProfileUpdateSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-T FR-T-11 — a registered customer updates their own profile: display name,
// optional phone, email/SMS contact preferences and the marketing opt-in. Gated
// FAIL-CLOSED on a signed-in customer (a signed-out visitor is rejected with no
// write); the input is Zod-validated; the update + its audit row run in ONE tenant
// transaction (G4). RLS scopes every query to the tenant and the update is
// additionally scoped to the customer's OWN user row (`id === session.userId`,
// `type=customer`), so one customer can never edit another's account. This is a
// self-service edit of an already-consented account holder, NOT fresh lead
// capture — there is no new GDPR-consent affirmation; the marketing-opt-in toggle
// is itself the consent control for marketing.

interface ProfileUserClient extends AuditWriter {
  user: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{
      name: string;
      phone: string | null;
      contactByEmail: boolean;
      contactBySms: boolean;
      marketingOptIn: boolean;
    } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a profile update, consumed by `useActionState`. */
export interface ProfileActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): ProfileActionState {
  return { ok: false, errors: [{ message }] };
}

/** Map Zod issues to the form's error shape (field-scoped where a path exists). */
function fromZod(issues: { path: PropertyKey[]; message: string }[]): ProfileActionState {
  return {
    ok: false,
    errors: issues.map((issue) => {
      const field = issue.path.join('.');
      return field ? { field, message: issue.message } : { message: issue.message };
    }),
  };
}

/** Read a checkbox value from FormData as a boolean (present/"on"/"true" → true). */
function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true';
}

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  // Fail-closed: only a signed-in customer may edit their profile.
  const session = await getCustomerSession();
  if (!session) return deny('Please sign in to update your profile.');

  const parsed = customerProfileUpdateSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? undefined,
    contactByEmail: checkbox(formData, 'contactByEmail'),
    contactBySms: checkbox(formData, 'contactBySms'),
    marketingOptIn: checkbox(formData, 'marketingOptIn'),
  });
  if (!parsed.success) return fromZod(parsed.error.issues);

  // An absent/cleared phone persists as NULL (the column is nullable).
  const { name, phone, contactByEmail, contactBySms, marketingOptIn } = parsed.data;
  const nextPhone = phone ?? null;
  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: ProfileActionState = deny('Your profile could not be updated. Please try again.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ProfileUserClient;
    // Scope strictly to the acting customer's own row (RLS already scopes to the
    // tenant; this also asserts the customer-type discriminator).
    const existing = await tx.user.findFirst({ where: { id: userId, type: 'customer' } });
    if (!existing) return; // not-found default — never edit a non-customer row

    await tx.user.update({
      where: { id: userId },
      data: {
        name,
        phone: nextPhone,
        contactByEmail,
        contactBySms,
        marketingOptIn,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'customer_profile.updated',
      entity: 'user',
      entityId: userId,
      diff: {
        name: { from: existing.name, to: name },
        phone: { from: existing.phone, to: nextPhone },
        contactByEmail: { from: existing.contactByEmail, to: contactByEmail },
        contactBySms: { from: existing.contactBySms, to: contactBySms },
        marketingOptIn: { from: existing.marketingOptIn, to: marketingOptIn },
      },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
