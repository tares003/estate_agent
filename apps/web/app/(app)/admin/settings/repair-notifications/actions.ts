'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { repairNotificationConfigSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../lib/tenant.js';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the audited, RBAC-gated save of a tenant's repair notification routing: the
// internal recipients master spec §G.7 routes new-ticket notifications to (the
// property-manager / branch-repairs-queue email + the on-call manager's phone).
// RBAC fail-closed BEFORE any read/write (requireStaffPermission('setting.manage')
// — the platform-settings permission); the submitted fields are validated with
// repairNotificationConfigSchema (an empty field clears that channel to null);
// the upsert (one config row per tenant) + an audit row are written in one tenant
// transaction (G4). This is an authenticated admin action — like the sibling
// settings actions (saveSdltConfig / saveMortgageRateConfig), it carries no
// Turnstile (G8 covers public, unauthenticated forms).

interface RepairNotificationConfigClient extends AuditWriter {
  repairNotificationConfig: {
    findFirst(args?: {
      select?: Record<string, unknown>;
    }): Promise<{ repairsEmail: string | null; onCallPhone: string | null } | null>;
    upsert(args: {
      where: { tenantId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a save, consumed by `useActionState`. */
export interface RepairNotificationConfigActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): RepairNotificationConfigActionState {
  return { ok: false, errors: [{ message }] };
}

/** Read a text field, mapping absent/blank to null (clearing that channel). */
function fieldOrNull(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function saveRepairNotificationConfig(
  _prevState: RepairNotificationConfigActionState,
  formData: FormData,
): Promise<RepairNotificationConfigActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to edit notification settings.');
  }

  const parsed = repairNotificationConfigSchema.safeParse({
    repairsEmail: fieldOrNull(formData, 'repairsEmail'),
    onCallPhone: fieldOrNull(formData, 'onCallPhone'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? { field, message: issue.message } : { message: issue.message };
      }),
    };
  }

  const config = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  let result: RepairNotificationConfigActionState = deny(
    'The notification settings could not be saved.',
  );
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairNotificationConfigClient;
    const existing = await tx.repairNotificationConfig.findFirst({
      select: { repairsEmail: true, onCallPhone: true },
    });
    await tx.repairNotificationConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...config },
      update: { ...config },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_notification_config.updated',
      entity: 'repair_notification_config',
      entityId: tenantId,
      diff: { config: { from: existing ?? null, to: config } },
      ip,
      userAgent,
    });
    result = { ok: true };
  });
  return result;
}
