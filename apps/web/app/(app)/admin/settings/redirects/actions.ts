'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { redirectCreateSchema, redirectUpdateSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-O FR-O-11 — the audited, RBAC-gated CRUD for a tenant's managed redirect rules
// (the admin 301/302 list of old→new path). Each action gates fail-closed BEFORE any
// write (requireStaffPermission('setting.manage')); the submitted form is validated
// with the redirect Zod schema; the mutation + an audit row are written in one tenant
// transaction (G4). These are authenticated admin actions — like the sibling admin
// write actions (saveSdltConfig / moderateFeedback), they carry no Turnstile (G8
// covers public, unauthenticated forms) and no GDPR consent (no personal data).

interface RedirectClient extends AuditWriter {
  redirect: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{
      id: string;
      sourcePath: string;
      destinationPath: string;
      type: string;
    } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
    delete(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a redirect mutation, consumed by `useActionState`. */
export interface RedirectActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): RedirectActionState {
  return { ok: false, errors: [{ message }] };
}

/** Map Zod issues to the form's field-linked error items. */
function fromZod(issues: { path: (string | number)[]; message: string }[]): RedirectActionState {
  return {
    ok: false,
    errors: issues.map((issue) => {
      const field = issue.path.join('.');
      return field ? { field, message: issue.message } : { message: issue.message };
    }),
  };
}

// FR-O-11 — add a redirect rule. The source path is unique per tenant; a duplicate is
// rejected before the insert so the unique index never has to throw.
export async function createRedirect(
  _prevState: RedirectActionState,
  formData: FormData,
): Promise<RedirectActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to manage redirects.');
  }

  const parsed = redirectCreateSchema.safeParse({
    sourcePath: formData.get('sourcePath'),
    destinationPath: formData.get('destinationPath'),
    type: formData.get('type'),
  });
  if (!parsed.success) {
    return fromZod(parsed.error.issues);
  }

  const input = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: RedirectActionState = deny('The redirect could not be saved.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RedirectClient;
    const clash = await tx.redirect.findFirst({ where: { sourcePath: input.sourcePath } });
    if (clash) {
      result = deny('A redirect already exists for that from-path.');
      return;
    }
    const created = await tx.redirect.create({
      data: {
        tenantId,
        sourcePath: input.sourcePath,
        destinationPath: input.destinationPath,
        type: input.type,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'redirect.created',
      entity: 'redirect',
      entityId: created.id,
      diff: {
        sourcePath: input.sourcePath,
        destinationPath: input.destinationPath,
        type: input.type,
      },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

// FR-O-11 — edit an existing redirect rule. The rule must exist; if the from-path
// changes it must not collide with another rule's from-path.
export async function updateRedirect(
  _prevState: RedirectActionState,
  formData: FormData,
): Promise<RedirectActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to manage redirects.');
  }

  const parsed = redirectUpdateSchema.safeParse({
    id: formData.get('id'),
    sourcePath: formData.get('sourcePath'),
    destinationPath: formData.get('destinationPath'),
    type: formData.get('type'),
  });
  if (!parsed.success) {
    return fromZod(parsed.error.issues);
  }

  const input = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: RedirectActionState = deny('This redirect could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RedirectClient;
    const existing = await tx.redirect.findFirst({ where: { id: input.id } });
    if (!existing) {
      return; // not-found default
    }
    if (input.sourcePath !== existing.sourcePath) {
      const clash = await tx.redirect.findFirst({ where: { sourcePath: input.sourcePath } });
      if (clash) {
        result = deny('A redirect already exists for that from-path.');
        return;
      }
    }
    await tx.redirect.update({
      where: { id: input.id },
      data: {
        sourcePath: input.sourcePath,
        destinationPath: input.destinationPath,
        type: input.type,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'redirect.updated',
      entity: 'redirect',
      entityId: input.id,
      diff: {
        sourcePath: { from: existing.sourcePath, to: input.sourcePath },
        destinationPath: { from: existing.destinationPath, to: input.destinationPath },
        type: { from: existing.type, to: input.type },
      },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

// FR-O-11 — remove a redirect rule.
export async function deleteRedirect(
  _prevState: RedirectActionState,
  formData: FormData,
): Promise<RedirectActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to manage redirects.');
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return deny('This redirect could not be found.');
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: RedirectActionState = deny('This redirect could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RedirectClient;
    const existing = await tx.redirect.findFirst({ where: { id } });
    if (!existing) {
      return; // not-found default
    }
    await tx.redirect.delete({ where: { id } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'redirect.deleted',
      entity: 'redirect',
      entityId: id,
      diff: {
        sourcePath: existing.sourcePath,
        destinationPath: existing.destinationPath,
        type: existing.type,
      },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
