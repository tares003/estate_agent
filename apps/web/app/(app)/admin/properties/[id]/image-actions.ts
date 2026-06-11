'use server';

import { randomUUID } from 'node:crypto';

import { signObjectToken } from '@estate/storage';
import { IMAGE_EXTENSIONS, propertyImageUploadSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getStorageBackend, storageSigningSecret } from '../../../lib/storage.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-F property images (FR-F-6) — the two halves of the direct-upload flow.
// 1) createPropertyImageUpload: RBAC `property.write` (fail-closed) → tenant-
//    scoped listing check → mint a storage key under the listing's tenant prefix
//    and a short-lived signed token bound to exactly that key. Issuing a token
//    writes nothing, so there is no audit row here — the state change is the
//    finalize.
// 2) finalizePropertyImage (after the client PUTs the bytes): RBAC → tenant-
//    scoped listing check → the key MUST sit under this tenant+listing prefix
//    (a token for another listing cannot be grafted on) AND the object must
//    actually exist in storage → create the PropertyImage row (the stored `url`
//    is the storage KEY — serving mints signed URLs at render time; first image
//    becomes the hero) + audit `property_image.created` in the same tenant
//    transaction (G4).
// FR-F-7 (EXIF strip + thumb/large variants) is the deferred workers job.

interface PropertyImageClient extends AuditWriter {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
  propertyImage: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

const TOKEN_TTL_MS = 10 * 60_000;

/** The issuance result the client dropzone consumes. */
export interface PropertyImageUploadGrant {
  ok: boolean;
  /** The storage key the upload must land at (echoed back to finalize). */
  key?: string;
  /** The signed token authorising a PUT of exactly that key. */
  token?: string;
  errors?: FormErrorItem[];
}

export async function createPropertyImageUpload(input: {
  propertyId: string;
  contentType: string;
}): Promise<PropertyImageUploadGrant> {
  const parsed = propertyImageUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: [{ message: 'That file type cannot be uploaded.' }] };
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to edit listings.' }] };
  }

  const { propertyId, contentType } = parsed.data;
  const tenantId = await getCurrentTenantId();

  const property = await withTenant(getDb(), tenantId, (rawTx) =>
    (rawTx as unknown as PropertyImageClient).property.findFirst({
      where: { id: propertyId, deletedAt: null },
    }),
  );
  if (!property) {
    return { ok: false, errors: [{ message: 'Property not found.' }] };
  }

  const extension = IMAGE_EXTENSIONS[contentType];
  const key = `tenants/${tenantId}/properties/${propertyId}/${randomUUID()}.${extension}`;
  const token = signObjectToken(key, Date.now() + TOKEN_TTL_MS, storageSigningSecret());
  return { ok: true, key, token };
}

/** The finalize result, consumed by the uploader UI. */
export interface PropertyImageFinalizeState {
  ok: boolean;
  errors?: FormErrorItem[];
}

export async function finalizePropertyImage(input: {
  propertyId: string;
  key: string;
  alt: string;
}): Promise<PropertyImageFinalizeState> {
  const parsed = propertyImageUploadSchema
    .pick({ propertyId: true })
    .safeParse({ propertyId: input.propertyId });
  const alt = input.alt.trim();
  if (!parsed.success || alt === '' || input.key.trim() === '') {
    return { ok: false, errors: [{ message: 'The upload could not be recorded.' }] };
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('property.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to edit listings.' }] };
  }

  const { propertyId } = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  // The key must sit under THIS tenant+listing prefix — a signed token for some
  // other listing (or tenant) cannot be grafted onto this one.
  const prefix = `tenants/${tenantId}/properties/${propertyId}/`;
  if (!input.key.startsWith(prefix)) {
    return { ok: false, errors: [{ message: 'That upload does not belong to this listing.' }] };
  }

  // The bytes must actually have landed.
  const uploaded = await getStorageBackend().exists(input.key);
  if (!uploaded) {
    return { ok: false, errors: [{ message: 'The upload has not arrived yet — try again.' }] };
  }

  let result: PropertyImageFinalizeState = {
    ok: false,
    errors: [{ message: 'Property not found.' }],
  };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as PropertyImageClient;
    const property = await tx.property.findFirst({ where: { id: propertyId, deletedAt: null } });
    if (!property) {
      return; // result stays the not-found default
    }
    const existing = await tx.propertyImage.count({ where: { propertyId } });
    const created = await tx.propertyImage.create({
      data: {
        tenantId,
        propertyId,
        url: input.key,
        alt,
        sortOrder: existing,
        isPrimary: existing === 0,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'property_image.created',
      entity: 'property_image',
      entityId: created.id,
      diff: { url: { from: null, to: input.key } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
