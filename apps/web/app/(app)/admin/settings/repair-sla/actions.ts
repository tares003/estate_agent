'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import {
  DEFAULT_REPAIR_SLA_CONFIG,
  repairSlaConfigSchema,
  type RepairSlaConfigInput,
} from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../lib/tenant.js';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// audited, RBAC-gated save of a tenant's repair SLA configuration: the per-urgency
// §G.4 SLA targets (which §G.4 itself marks "(configurable)") and the two FR-G-9
// SLA-breach-badge thresholds. RBAC fail-closed BEFORE any read/write
// (requireStaffPermission('setting.manage') — the platform-settings permission); the
// submitted fields are validated with repairSlaConfigSchema (whole positive numbers;
// thresholds inside 1–99% and strictly ascending); the upsert (one config row per
// tenant) + an audit row are written in one tenant transaction (G4). This is an
// authenticated admin action — like the sibling settings actions (saveSdltConfig /
// saveRepairNotificationConfig) it carries no Turnstile (G8 covers public,
// unauthenticated forms).
//
// This module carries the 'use server' directive, so it exports only async functions
// (the action-state interface is a type — erased at build).

/** The columns the before-image reads — the config, no over-fetch. */
const SELECT = {
  emergencyTargetHours: true,
  urgentTargetHours: true,
  standardTargetHours: true,
  lowTargetWorkingDays: true,
  dueSoonThresholdPercent: true,
  atRiskThresholdPercent: true,
} as const;

/** The structural tenant-scoped client this action reads + writes through. */
interface RepairSlaConfigClient extends AuditWriter {
  repairSlaConfig: {
    findFirst(args?: { select?: Record<string, unknown> }): Promise<RepairSlaConfigInput | null>;
    upsert(args: {
      where: { tenantId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a save, consumed by `useActionState`. */
export interface RepairSlaConfigActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): RepairSlaConfigActionState {
  return { ok: false, errors: [{ message }] };
}

/** Read a numeric field; a blank or non-numeric entry yields NaN, which Zod rejects. */
function numberField(formData: FormData, name: string): number {
  const value = formData.get(name);
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
}

export async function saveRepairSlaConfig(
  _prevState: RepairSlaConfigActionState,
  formData: FormData,
): Promise<RepairSlaConfigActionState> {
  try {
    await requireStaffPermission('setting.manage');
  } catch {
    return deny('You do not have permission to edit SLA settings.');
  }

  const parsed = repairSlaConfigSchema.safeParse({
    emergencyTargetHours: numberField(formData, 'emergencyTargetHours'),
    urgentTargetHours: numberField(formData, 'urgentTargetHours'),
    standardTargetHours: numberField(formData, 'standardTargetHours'),
    lowTargetWorkingDays: numberField(formData, 'lowTargetWorkingDays'),
    dueSoonThresholdPercent: numberField(formData, 'dueSoonThresholdPercent'),
    atRiskThresholdPercent: numberField(formData, 'atRiskThresholdPercent'),
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

  const config: RepairSlaConfigInput = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  let result: RepairSlaConfigActionState = deny('The SLA settings could not be saved.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairSlaConfigClient;
    // The audit's "from" is what the tenant was actually banded by: their stored row,
    // or the §G.4 / FR-G-9 defaults when they had configured none.
    const existing = await tx.repairSlaConfig.findFirst({ select: SELECT });
    await tx.repairSlaConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...config },
      update: { ...config },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_sla_config.updated',
      entity: 'repair_sla_config',
      entityId: tenantId,
      diff: { config: { from: existing ?? DEFAULT_REPAIR_SLA_CONFIG, to: config } },
      ip,
      userAgent,
    });
    result = { ok: true };
  });
  return result;
}
