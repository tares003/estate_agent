'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { mortgageRatePresetListSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-W FR-W-8 — the audited, RBAC-gated save of a tenant's mortgage rate presets.
// RBAC fail-closed before any write (requireStaffPermission('calculator_config.manage')
// — the SAME permission as the mortgage-default + SDLT band editors); the submitted
// JSON array is validated with mortgageRatePresetListSchema. The save REPLACES the
// tenant's preset list — deleteMany (all existing) + createMany (the new list, with a
// derived sort_order) — and an audit row (G4), all in ONE tenant transaction. This is
// an authenticated admin action — like the sibling admin write actions, it carries no
// Turnstile (G8 covers public, unauthenticated forms).

interface MortgageRatePresetClient extends AuditWriter {
  mortgageRatePreset: {
    findMany(args?: {
      select?: { label: true; annualRatePercent: true; termYears: true; sortOrder: true };
    }): Promise<unknown[]>;
    deleteMany(args?: Record<string, unknown>): Promise<{ count: number }>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
  };
}

/** The result of a save, consumed by `useActionState`. */
export interface MortgageRatePresetActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): MortgageRatePresetActionState {
  return { ok: false, errors: [{ message }] };
}

export async function saveMortgageRatePresets(
  _prevState: MortgageRatePresetActionState,
  formData: FormData,
): Promise<MortgageRatePresetActionState> {
  try {
    await requireStaffPermission('calculator_config.manage');
  } catch {
    return deny('You do not have permission to edit calculator configuration.');
  }

  const raw = formData.get('presets');
  if (typeof raw !== 'string' || raw.length === 0) {
    return deny('No presets were submitted.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return deny('The presets could not be read.');
  }

  const parsed = mortgageRatePresetListSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? { field, message: issue.message } : { message: issue.message };
      }),
    };
  }

  const presets = parsed.data;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: MortgageRatePresetActionState = deny('The presets could not be saved.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as MortgageRatePresetClient;
    const existing = await tx.mortgageRatePreset.findMany({
      select: { label: true, annualRatePercent: true, termYears: true, sortOrder: true },
    });
    await tx.mortgageRatePreset.deleteMany();
    if (presets.length > 0) {
      await tx.mortgageRatePreset.createMany({
        data: presets.map((preset, index) => ({ tenantId, ...preset, sortOrder: index })),
      });
    }
    await audit(tx, {
      tenantId,
      actor,
      action: 'calculator_config.updated',
      entity: 'mortgage_rate_presets',
      entityId: tenantId,
      diff: { presets: { from: existing, to: presets } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
