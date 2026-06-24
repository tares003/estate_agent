// EPIC-H FR-H-4 — the admin assignment-rules read model. Lists a tenant's routing
// rules in evaluation order (position ascending), so the editor renders them in the
// same top-down order the runtime router applies (first-match-wins). Tenant
// isolation is applied by the caller via withTenant (RLS). The structural reader
// interface keeps this DB-free for unit tests — a Prisma tx satisfies it.

import type { AssignmentCondition, AssignmentTarget } from '@estate/validators';

/** A rule row shown in the editor list. */
export interface AssignmentRuleRow {
  id: string;
  name: string;
  conditions: AssignmentCondition[];
  assignment: AssignmentTarget;
  position: number;
  isEnabled: boolean;
}

/** Minimal read surface the list needs (a Prisma tx satisfies it). */
export interface AssignmentRulesReader {
  assignmentRule: {
    findMany(args: { orderBy?: unknown }): Promise<AssignmentRuleRow[]>;
  };
}

/**
 * List the tenant's assignment rules in evaluation order (position ascending).
 * The order is load-bearing: the router evaluates rules top-down, first-match-wins
 * (FR-H-4), so the editor must show them in the same order.
 */
export async function listAssignmentRules(
  reader: AssignmentRulesReader,
): Promise<AssignmentRuleRow[]> {
  return reader.assignmentRule.findMany({ orderBy: { position: 'asc' } });
}
