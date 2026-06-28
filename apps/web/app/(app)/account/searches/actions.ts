'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import {
  savedSearchCreateSchema,
  savedSearchUpdateSchema,
  type AlertFrequency,
} from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-T FR-T-7/8 — a registered customer saves the active /properties filter
// combination as a named saved search, then views / renames / re-cadences /
// deletes their searches. Every write is gated FAIL-CLOSED on a signed-in,
// EMAIL-VERIFIED customer (FR-T-2 — a signed-out or unverified visitor is rejected
// with no write); the input is Zod-validated; the mutation + its audit row run in
// ONE tenant transaction (G4); RLS scopes every query to the tenant and each
// statement is additionally scoped to the customer's OWN rows (`userId`), so one
// customer can never touch another's saved search. The email-alert DELIVERY (the
// daily/weekly digest worker) is a separate EPIC-U slice — this persists the
// cadence only.

interface SavedSearchClient extends AuditWriter {
  savedSearch: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; name: string; alertFrequency: AlertFrequency } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
    delete(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a saved-search write, consumed by `useActionState`. */
export interface SavedSearchActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): SavedSearchActionState {
  return { ok: false, errors: [{ message }] };
}

/** Map Zod issues to the form's error shape (field-scoped where a path exists). */
function fromZod(issues: { path: PropertyKey[]; message: string }[]): SavedSearchActionState {
  return {
    ok: false,
    errors: issues.map((issue) => {
      const field = issue.path.join('.');
      return field ? { field, message: issue.message } : { message: issue.message };
    }),
  };
}

/** The signed-in, email-verified customer session, or null (fail-closed gate). */
async function requireVerifiedCustomer() {
  const session = await getCustomerSession();
  if (!session || !session.emailVerified) return null;
  return session;
}

// FR-T-7 — create a named saved search from the active /properties filters. The
// name + filters + cadence are validated; a duplicate name for this customer is
// rejected with a friendly message (the storage layer also has a
// (tenant,user,name) unique constraint, but checking first keeps the error clean).
export async function createSavedSearch(
  _prevState: SavedSearchActionState,
  formData: FormData,
): Promise<SavedSearchActionState> {
  const session = await requireVerifiedCustomer();
  if (!session) return deny('Please sign in and verify your email to save a search.');

  let filters: unknown;
  const raw = formData.get('filters');
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      filters = JSON.parse(raw);
    } catch {
      return deny('That search could not be saved. Please try again.');
    }
  } else {
    filters = {};
  }

  const parsed = savedSearchCreateSchema.safeParse({
    searchName: formData.get('name'),
    filters,
    alertFrequency: formData.get('alertFrequency') ?? undefined,
  });
  if (!parsed.success) return fromZod(parsed.error.issues);

  // The schema field is `searchName` (a label, not a person's name — G5); the
  // storage column is `name`, so re-key it here.
  const { searchName: name, alertFrequency } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: SavedSearchActionState = deny('That search could not be saved. Please try again.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SavedSearchClient;
    const clash = await tx.savedSearch.findFirst({ where: { userId, name } });
    if (clash) {
      result = deny('You already have a saved search with that name.');
      return;
    }
    const created = await tx.savedSearch.create({
      data: { tenantId, userId, name, filters: parsed.data.filters, alertFrequency },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'saved_search.created',
      entity: 'saved_search',
      entityId: created.id,
      diff: { userId, name, alertFrequency },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

/** Read the customer's own saved search by id within the current transaction. */
async function ownSearch(tx: SavedSearchClient, id: string, userId: string) {
  return tx.savedSearch.findFirst({ where: { id, userId } });
}

// FR-T-8 — rename a saved search. The new name is validated; the search must exist
// and belong to the acting customer; a name already used by another of their
// searches is rejected. The rename + an audit row carrying the before/after run in
// one tenant transaction (G4).
export async function renameSavedSearch(
  _prevState: SavedSearchActionState,
  formData: FormData,
): Promise<SavedSearchActionState> {
  const session = await requireVerifiedCustomer();
  if (!session) return deny('Please sign in and verify your email to manage your searches.');

  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return deny('That saved search could not be found.');
  }

  // Only the name field is relevant; the action keeps the existing cadence.
  const parsed = savedSearchUpdateSchema.pick({ searchName: true }).safeParse({
    searchName: formData.get('name'),
  });
  if (!parsed.success) return fromZod(parsed.error.issues);

  const { searchName: name } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: SavedSearchActionState = deny('That saved search could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SavedSearchClient;
    const existing = await ownSearch(tx, id, userId);
    if (!existing) return; // not-found default
    if (existing.name === name) {
      result = { ok: true }; // no-op rename to the same name
      return;
    }
    const clash = await tx.savedSearch.findFirst({ where: { userId, name } });
    if (clash) {
      result = deny('You already have a saved search with that name.');
      return;
    }
    await tx.savedSearch.update({ where: { id }, data: { name } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'saved_search.renamed',
      entity: 'saved_search',
      entityId: id,
      diff: { name: { from: existing.name, to: name } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

// FR-T-8 — change a saved search's alert cadence (off / instant / daily / weekly).
// The cadence is validated; the search must belong to the acting customer; the
// update + an audit row carrying the before/after run in one tenant transaction
// (G4). Delivery is out of scope (EPIC-U) — this persists the cadence only.
export async function updateSavedSearchFrequency(
  _prevState: SavedSearchActionState,
  formData: FormData,
): Promise<SavedSearchActionState> {
  const session = await requireVerifiedCustomer();
  if (!session) return deny('Please sign in and verify your email to manage your searches.');

  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return deny('That saved search could not be found.');
  }

  const parsed = savedSearchUpdateSchema.pick({ alertFrequency: true }).safeParse({
    alertFrequency: formData.get('alertFrequency') ?? undefined,
  });
  if (!parsed.success) return fromZod(parsed.error.issues);

  const { alertFrequency } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: SavedSearchActionState = deny('That saved search could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SavedSearchClient;
    const existing = await ownSearch(tx, id, userId);
    if (!existing) return; // not-found default
    await tx.savedSearch.update({ where: { id }, data: { alertFrequency } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'saved_search.frequency_changed',
      entity: 'saved_search',
      entityId: id,
      diff: { alertFrequency: { from: existing.alertFrequency, to: alertFrequency } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

// FR-T-8 — delete a saved search. The search must belong to the acting customer;
// the delete + an audit row run in one tenant transaction (G4).
export async function deleteSavedSearch(
  _prevState: SavedSearchActionState,
  formData: FormData,
): Promise<SavedSearchActionState> {
  const session = await requireVerifiedCustomer();
  if (!session) return deny('Please sign in and verify your email to manage your searches.');

  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return deny('That saved search could not be found.');
  }

  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: SavedSearchActionState = deny('That saved search could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SavedSearchClient;
    const existing = await ownSearch(tx, id, userId);
    if (!existing) return; // not-found default
    await tx.savedSearch.delete({ where: { id } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'saved_search.deleted',
      entity: 'saved_search',
      entityId: id,
      diff: { userId, name: existing.name },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
