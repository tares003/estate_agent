'use server';

import { z } from 'zod';
import { DEFAULT_REPAIR_CATEGORIES } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-G repair categories admin (FR-G-4, master spec §G.3) — the audited,
// RBAC-gated mutations for the category catalogue. Both gate on
// `repair_request.manage` (fail-closed before any read/write), run inside the
// tenant (RLS) scope, and audit (G4). Seeding is idempotent (a populated
// catalogue is left untouched). Relabel / reorder / custom-create are a later
// refinement. Drive forms via `useActionState`.

interface CategoryClient extends AuditWriter {
  repairCategory: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; slug: string; visible: boolean } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a category mutation, consumed by `useActionState`. */
export interface CategoryActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): CategoryActionState {
  return { ok: false, errors: [{ message }] };
}

/** Seed the §G.3 defaults — only when the tenant's catalogue is empty. */
export async function seedRepairCategories(
  _prevState: CategoryActionState,
  _formData: FormData,
): Promise<CategoryActionState> {
  try {
    await requireStaffPermission('repair_request.manage');
  } catch {
    return deny('You do not have permission to manage repair categories.');
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: CategoryActionState = deny('The catalogue already has categories.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as CategoryClient;
    if ((await tx.repairCategory.count({})) > 0) {
      return; // result stays the already-seeded default
    }
    await tx.repairCategory.createMany({
      data: DEFAULT_REPAIR_CATEGORIES.map((category, index) => ({
        tenantId,
        slug: category.slug,
        label: category.label,
        defaultUrgency: category.defaultUrgency,
        sortOrder: index,
      })),
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_category.seeded',
      entity: 'repair_category',
      entityId: tenantId,
      diff: { seeded: { from: 0, to: DEFAULT_REPAIR_CATEGORIES.length } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}

const visibilitySchema = z.object({
  slug: z.string().min(1),
  visible: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

/** Show or hide one category in the public dropdown. */
export async function setRepairCategoryVisibility(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = visibilitySchema.safeParse({
    slug: formData.get('slug'),
    visible: formData.get('visible'),
  });
  if (!parsed.success) {
    return deny('That visibility change is not valid.');
  }

  try {
    await requireStaffPermission('repair_request.manage');
  } catch {
    return deny('You do not have permission to manage repair categories.');
  }

  const { slug, visible } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: CategoryActionState = deny('That category could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as CategoryClient;
    const category = await tx.repairCategory.findFirst({ where: { slug } });
    if (!category) {
      return; // result stays the not-found default
    }
    await tx.repairCategory.update({ where: { id: category.id }, data: { visible } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_category.visibility_changed',
      entity: 'repair_category',
      entityId: category.id,
      diff: { visible: { from: category.visible, to: visible } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
