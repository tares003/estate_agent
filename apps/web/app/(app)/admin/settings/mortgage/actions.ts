'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { mortgageRateConfigSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-W FR-W-7 — the audited, RBAC-gated save of a tenant's mortgage-default config.
// RBAC fail-closed before any write (requireStaffPermission('calculator_config.manage')
// — the SAME permission as the SDLT band editor); the submitted JSON is validated with
// mortgageRateConfigSchema (the engine's MortgageRateConfig shape); the upsert (one
// config per tenant) + an audit row are written in one tenant transaction (G4). This
// is an authenticated admin action — like the sibling admin write actions (saveSdltConfig
// / moderateFeedback), it carries no Turnstile (G8 covers public, unauthenticated forms).

interface MortgageRateConfigClient extends AuditWriter {
  mortgageRateConfig: {
    findFirst(args?: { select?: { config: true } }): Promise<{ config: unknown } | null>;
    upsert(args: {
      where: { tenantId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

/** The result of a save, consumed by `useActionState`. */
export interface MortgageRateConfigActionState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): MortgageRateConfigActionState {
  return { ok: false, errors: [{ message }] };
}

export async function saveMortgageRateConfig(
  _prevState: MortgageRateConfigActionState,
  formData: FormData,
): Promise<MortgageRateConfigActionState> {
  try {
    await requireStaffPermission('calculator_config.manage');
  } catch {
    return deny('You do not have permission to edit calculator configuration.');
  }

  const raw = formData.get('config');
  if (typeof raw !== 'string' || raw.length === 0) {
    return deny('No configuration was submitted.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return deny('The configuration could not be read.');
  }

  const parsed = mortgageRateConfigSchema.safeParse(payload);
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

  let result: MortgageRateConfigActionState = deny('The configuration could not be saved.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as MortgageRateConfigClient;
    const existing = await tx.mortgageRateConfig.findFirst({ select: { config: true } });
    await tx.mortgageRateConfig.upsert({
      where: { tenantId },
      create: { tenantId, config },
      update: { config },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'calculator_config.updated',
      entity: 'mortgage_rate_config',
      entityId: tenantId,
      diff: { config: { from: existing?.config ?? null, to: config } },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
