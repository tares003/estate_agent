'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { seoMetadataUpsertSchema, type SeoMetadataUpsert } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-O FR-O-4 — the audited, RBAC-gated upsert + delete for a tenant's per-entity
// SEO overrides (the admin meta-title / description / canonical / OG-image / noindex
// editor + the tenant-wide default). Each action gates fail-closed BEFORE any write
// (requireStaffPermission('setting.manage')); the submitted form is validated with the
// seoMetadataUpsertSchema; the mutation + an audit row are written in one tenant
// transaction (G4). These are authenticated admin actions — like the sibling admin
// write actions (createRedirect / saveSdltConfig), they carry no Turnstile (G8 covers
// public, unauthenticated forms) and no GDPR consent (no personal data).
//
// One override per (scope, scopeId): the upsert looks the existing row up first, so a
// repeat save updates the same row rather than creating a duplicate.

interface SeoMetadataClient extends AuditWriter {
  seoMetadata: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{
      id: string;
      metaTitle: string | null;
      metaDescription: string | null;
      canonicalUrl: string | null;
      ogImage: string | null;
      noIndex: boolean;
      noFollow: boolean;
      structuredData: unknown;
    } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
    delete(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of an SEO-metadata mutation, consumed by `useActionState`. */
export interface SeoMetadataActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): SeoMetadataActionState {
  return { ok: false, errors: [{ message }] };
}

/** Map Zod issues to the form's field-linked error items. */
function fromZod(issues: { path: (string | number)[]; message: string }[]): SeoMetadataActionState {
  return {
    ok: false,
    errors: issues.map((issue) => {
      const field = issue.path.join('.');
      return field ? { field, message: issue.message } : { message: issue.message };
    }),
  };
}

/** Parse the optional structured-data JSON field; returns the parse error message on failure. */
function parseStructuredData(
  raw: FormDataEntryValue | null,
): { ok: true; value: unknown } | { ok: false } {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** The persisted columns an upsert writes, derived from the validated input. */
function columnsFor(input: SeoMetadataUpsert): Record<string, unknown> {
  return {
    metaTitle: input.metaTitle ?? null,
    metaDescription: input.metaDescription ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    ogImage: input.ogImage ?? null,
    noIndex: input.noIndex,
    noFollow: input.noFollow,
    structuredData: input.structuredData ?? null,
  };
}

// FR-O-4 — create or update the SEO override for one (scope, scopeId). One row per
// scope/scopeId: an existing row is updated; otherwise a new row is created.
export async function upsertSeoMetadata(
  _prevState: SeoMetadataActionState,
  formData: FormData,
): Promise<SeoMetadataActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to manage SEO settings.');
  }

  const structuredData = parseStructuredData(formData.get('structuredData'));
  if (!structuredData.ok) {
    return { ok: false, errors: [{ field: 'structuredData', message: 'Enter valid JSON.' }] };
  }

  const scopeId = formData.get('scopeId');
  const parsed = seoMetadataUpsertSchema.safeParse({
    scope: formData.get('scope'),
    scopeId: typeof scopeId === 'string' && scopeId.length > 0 ? scopeId : null,
    metaTitle: formData.get('metaTitle') ?? undefined,
    metaDescription: formData.get('metaDescription') ?? undefined,
    canonicalUrl: formData.get('canonicalUrl') ?? undefined,
    ogImage: formData.get('ogImage') ?? undefined,
    noIndex: formData.get('noIndex') === 'on',
    noFollow: formData.get('noFollow') === 'on',
    structuredData: structuredData.value,
  });
  if (!parsed.success) {
    return fromZod(parsed.error.issues);
  }

  const input = parsed.data;
  const scopeIdValue = input.scopeId ?? null;
  const columns = columnsFor(input);
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: SeoMetadataActionState = deny('The SEO override could not be saved.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SeoMetadataClient;
    const existing = await tx.seoMetadata.findFirst({
      where: { scope: input.scope, scopeId: scopeIdValue },
    });
    if (existing) {
      await tx.seoMetadata.update({ where: { id: existing.id }, data: columns });
      await audit(tx, {
        tenantId,
        actor,
        action: 'seo_metadata.updated',
        entity: 'seo_metadata',
        entityId: existing.id,
        diff: {
          scope: input.scope,
          scopeId: scopeIdValue,
          from: {
            metaTitle: existing.metaTitle,
            metaDescription: existing.metaDescription,
            canonicalUrl: existing.canonicalUrl,
            ogImage: existing.ogImage,
            noIndex: existing.noIndex,
            noFollow: existing.noFollow,
          },
          to: columns,
        },
        ip,
      });
    } else {
      const created = await tx.seoMetadata.create({
        data: { tenantId, scope: input.scope, scopeId: scopeIdValue, ...columns },
      });
      await audit(tx, {
        tenantId,
        actor,
        action: 'seo_metadata.created',
        entity: 'seo_metadata',
        entityId: created.id,
        diff: { scope: input.scope, scopeId: scopeIdValue, ...columns },
        ip,
      });
    }
    result = { ok: true };
  });
  return result;
}

// FR-O-4 — remove an SEO override (the entity / default falls back to the resolver's
// next level once the row is gone).
export async function deleteSeoMetadata(
  _prevState: SeoMetadataActionState,
  formData: FormData,
): Promise<SeoMetadataActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to manage SEO settings.');
  }

  const id = formData.get('id');
  if (typeof id !== 'string' || id.length === 0) {
    return deny('This SEO override could not be found.');
  }

  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: SeoMetadataActionState = deny('This SEO override could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SeoMetadataClient;
    const existing = await tx.seoMetadata.findFirst({ where: { id } });
    if (!existing) {
      return; // not-found default
    }
    await tx.seoMetadata.delete({ where: { id } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'seo_metadata.deleted',
      entity: 'seo_metadata',
      entityId: id,
      diff: {
        metaTitle: existing.metaTitle,
        metaDescription: existing.metaDescription,
        canonicalUrl: existing.canonicalUrl,
        ogImage: existing.ogImage,
        noIndex: existing.noIndex,
        noFollow: existing.noFollow,
      },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
