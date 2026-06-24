'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { savedPropertyToggleSchema } from '@estate/validators';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-T FR-T-5/6 — a registered customer saves / unsaves a property to favourites.
// Gated FAIL-CLOSED on a signed-in, EMAIL-VERIFIED customer (FR-T-2 — an unverified
// or signed-out visitor is rejected with no write). The propertyId is Zod-validated
// (must be a UUID). The toggle is idempotent: it looks up an existing
// saved_properties row for (tenant, user, property) and DELETES it if present
// (unsave) or CREATES it otherwise (save). The mutation + its audit row run in ONE
// tenant transaction (G4); RLS scopes every query to the tenant.

interface SavedPropertyClient extends AuditWriter {
  savedProperty: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    delete(args: { where: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a toggle, consumed by the heart's optimistic UI. */
export interface SaveToggleState {
  ok: boolean;
  /** The resulting saved state when `ok` (true = now saved, false = now unsaved). */
  saved?: boolean;
}

const DENY: SaveToggleState = { ok: false };

export async function toggleSavedProperty(
  _prevState: SaveToggleState,
  formData: FormData,
): Promise<SaveToggleState> {
  // FR-T-2: only a signed-in, email-verified customer may save (fail-closed).
  const session = await getCustomerSession();
  if (!session || !session.emailVerified) {
    return DENY;
  }

  const parsed = savedPropertyToggleSchema.safeParse({ propertyId: formData.get('propertyId') });
  if (!parsed.success) {
    return DENY;
  }
  const { propertyId } = parsed.data;

  const tenantId = await getCurrentTenantId();
  const { userId, actor } = session;
  const ip = await getRequestIp();

  let result: SaveToggleState = DENY;
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as SavedPropertyClient;
    const existing = await tx.savedProperty.findFirst({ where: { userId, propertyId } });
    if (existing) {
      await tx.savedProperty.delete({ where: { id: existing.id } });
      await audit(tx, {
        tenantId,
        actor,
        action: 'saved_property.unsaved',
        entity: 'saved_property',
        entityId: propertyId,
        diff: { userId },
        ip,
      });
      result = { ok: true, saved: false };
      return;
    }
    await tx.savedProperty.create({ data: { tenantId, userId, propertyId } });
    await audit(tx, {
      tenantId,
      actor,
      action: 'saved_property.saved',
      entity: 'saved_property',
      entityId: propertyId,
      diff: { userId },
      ip,
    });
    result = { ok: true, saved: true };
  });
  return result;
}
