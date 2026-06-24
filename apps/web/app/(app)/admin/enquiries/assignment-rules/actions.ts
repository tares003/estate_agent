'use server';

import { assignmentRuleSchema } from '@estate/validators';
import { audit, withTenant, type AuditWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-H FR-H-4 (master spec §H.6): a staff member composes a no-code enquiry
// assignment rule (IF <conditions> THEN assign to <agent|branch>). RBAC-gated on
// `enquiry.write` (fail-closed BEFORE any read/write — a rule edit changes how
// every future enquiry routes); the IF/THEN payload is validated against
// assignmentRuleSchema (empty rules, bad target ids and malformed JSON are
// rejected before the transaction); the new rule is APPENDED at max(position)+1 so
// it loses to the existing chain until reordered (first-match-wins is
// order-sensitive); the create + an `audit_logs` row are written in one
// tenant-scoped transaction (G4). Drives a form via `useActionState`.

/** The tenant-scoped client surface this action reads/writes through. */
interface AssignmentRuleClient extends AuditWriter {
  assignmentRule: {
    aggregate(args: { _max: { position: true } }): Promise<{ _max: { position: number | null } }>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** The result of a create, consumed by `useActionState`. */
export interface AssignmentRuleState {
  ok: boolean;
  ruleId?: string;
  errors?: FormErrorItem[];
}

function deny(message: string): AssignmentRuleState {
  return { ok: false, errors: [{ message }] };
}

/** Parse a JSON form field, returning undefined (not throwing) on malformed input. */
function parseJsonField(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function createAssignmentRule(
  _prevState: AssignmentRuleState,
  formData: FormData,
): Promise<AssignmentRuleState> {
  const name = formData.get('name');
  const parsed = assignmentRuleSchema.safeParse({
    name: typeof name === 'string' ? name : undefined,
    conditions: parseJsonField(formData, 'conditions'),
    assignment: parseJsonField(formData, 'assignment'),
  });
  if (!parsed.success) {
    const errors: FormErrorItem[] = parsed.error.issues.map((issue) => {
      const fieldKey = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
      return fieldKey === undefined
        ? { message: issue.message }
        : { field: fieldKey, message: issue.message };
    });
    return { ok: false, errors };
  }
  const rule = parsed.data;

  // RBAC gate — fail closed BEFORE any read/write (a rule edit is a write).
  try {
    await requireStaffPermission('enquiry.write');
  } catch {
    return deny('You do not have permission to manage assignment rules.');
  }

  const actor = await getStaffActor();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: AssignmentRuleState = deny('The assignment rule could not be created.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as AssignmentRuleClient;
    const max = await tx.assignmentRule.aggregate({ _max: { position: true } });
    const position = (max._max.position ?? -1) + 1;
    const created = await tx.assignmentRule.create({
      data: {
        tenantId,
        name: rule.name,
        conditions: rule.conditions,
        assignment: rule.assignment,
        position,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'assignment_rule.created',
      entity: 'assignment_rule',
      entityId: created.id,
      diff: {
        name: rule.name,
        conditions: rule.conditions,
        assignment: rule.assignment,
        position,
      },
      ip,
    });
    result = { ok: true, ruleId: created.id };
  });
  return result;
}
