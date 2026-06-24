import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import {
  listAssignmentRules,
  listAssignmentTargets,
  type AssignmentRulesReader,
  type AssignmentRuleRow,
  type AssignmentTargetsReader,
} from './assignment-rules-query.js';
import { AssignmentRuleComposer } from './AssignmentRuleComposer.js';
import { AssignmentRuleTester } from './AssignmentRuleTester.js';

// EPIC-H FR-H-4 (master spec §H.6) — the no-code assignment-rules editor. Gates on
// `enquiry.write` (RBAC fail-closed — a rule edit changes how every future enquiry
// routes), resolves the tenant, loads the rules (in evaluation order) and the
// agent/branch targets inside the tenant RLS scope, and renders the rule list, the
// IF/THEN composer and the rule-tester. The read models, the action and the two
// client components are unit-tested, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

/** A one-line human summary of a rule's IF clause for the list. */
function summariseConditions(rule: AssignmentRuleRow): string {
  return rule.conditions
    .map((condition) => {
      const value = condition.value ? ` "${condition.value}"` : '';
      return `${condition.field} ${condition.operator}${value}`;
    })
    .join(' AND ');
}

export default async function AssignmentRulesPage() {
  await requireStaffPermission('enquiry.write');

  const tenantId = await getCurrentTenantId();
  const { rules, targets } = await withTenant(getDb(), tenantId, async (tx) => ({
    rules: await listAssignmentRules(tx as unknown as AssignmentRulesReader),
    targets: await listAssignmentTargets(tx as unknown as AssignmentTargetsReader),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Assignment rules</h1>
        <p className="t-body-sm text-text-secondary max-w-[60ch]">
          Route incoming leads automatically. Rules run top to bottom — the first rule whose
          conditions all match decides the assignment. Test a sample before you save. Changes are
          recorded in the audit log.
        </p>
      </div>

      <section aria-labelledby="rule-list-heading" className="flex flex-col gap-4">
        <h2 id="rule-list-heading" className="t-title-md">
          Current rules
        </h2>
        {rules.length === 0 ? (
          <p className="t-body-md text-text-secondary max-w-[55ch]">
            No assignment rules yet. Add one below — until then, every lead stays unassigned for
            manual routing.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rules.map((rule, index) => (
              <li
                key={rule.id}
                className="border-divider flex flex-col gap-1 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="t-body-sm text-text-secondary">#{index + 1}</span>
                  <span className="t-title-sm">{rule.name}</span>
                  {rule.isEnabled ? (
                    <Badge tone="success">Enabled</Badge>
                  ) : (
                    <Badge tone="neutral">Disabled</Badge>
                  )}
                </div>
                <p className="t-body-sm text-text-secondary">
                  If {summariseConditions(rule)} then assign to {rule.assignment.targetType}.
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="rule-add-heading" className="flex flex-col gap-4">
        <h2 id="rule-add-heading" className="t-title-md">
          Add a rule
        </h2>
        <AssignmentRuleComposer targets={targets} />
      </section>

      <AssignmentRuleTester rules={rules} />
    </div>
  );
}
