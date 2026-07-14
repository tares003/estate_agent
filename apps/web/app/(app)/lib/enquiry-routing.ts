import {
  assignmentRuleSchema,
  evaluateAssignmentRules,
  type AssignmentRule,
  type SampleEnquiry,
} from '@estate/validators';

// EPIC-I FR-I-3 (master spec §I.4; audit finding assignment-rules-never-applied) —
// the runtime enquiry router. Every enquiry-creation action calls
// resolveEnquiryAssignment inside its tenant-scoped tx: the tenant's ENABLED
// assignment rules are loaded in evaluation order (position ascending) and
// evaluated top-down, first-match-wins, via @estate/validators'
// evaluateAssignmentRules (the same pure engine the admin rule-tester runs). The
// winning agent-or-branch target is persisted on the enquiry row; an unmatched
// enquiry stays unassigned (both references null). Tenant isolation comes from
// the caller's withTenant scope (RLS); this module performs reads only.

/** A stored rule row as the runtime router reads it (JSONB payloads untyped). */
interface AssignmentRuleRow {
  name: string;
  conditions: unknown;
  assignment: unknown;
}

/** Minimal read surface the router needs (a tenant-scoped Prisma tx satisfies it). */
export interface AssignmentRuleReader {
  assignmentRule: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<AssignmentRuleRow[]>;
  };
}

/** The routing outcome an action persists on the enquiry it creates. */
export interface EnquiryAssignment {
  /** Whether any rule matched. */
  matched: boolean;
  /** The winning agent target, or null (unmatched, or a branch target won). */
  assignedAgentId: string | null;
  /** The winning branch target, or null (unmatched, or an agent target won). */
  assignedBranchId: string | null;
}

/** The unassigned outcome (no rules, no match, or nothing valid to evaluate). */
const UNASSIGNED: EnquiryAssignment = {
  matched: false,
  assignedAgentId: null,
  assignedBranchId: null,
};

/**
 * Evaluate the tenant's enabled assignment rules against the enquiry being
 * created and return the columns to persist. Rules are consulted top-down
 * (position ascending), first-match-wins (FR-I-3). A stored row that no longer
 * parses against the rule schema is skipped rather than blocking intake —
 * writes are schema-validated, so this is a defensive guard only.
 */
export async function resolveEnquiryAssignment(
  db: AssignmentRuleReader,
  enquiry: SampleEnquiry,
): Promise<EnquiryAssignment> {
  const rows = await db.assignmentRule.findMany({
    where: { isEnabled: true },
    orderBy: { position: 'asc' },
  });

  const rules: AssignmentRule[] = [];
  for (const row of rows) {
    const parsed = assignmentRuleSchema.safeParse({
      ruleName: row.name,
      conditions: row.conditions,
      assignment: row.assignment,
    });
    if (parsed.success) rules.push(parsed.data);
  }

  const evaluation = evaluateAssignmentRules(rules, enquiry);
  if (!evaluation.matched || evaluation.assignment === null) {
    return UNASSIGNED;
  }
  const { targetType, targetId } = evaluation.assignment;
  return {
    matched: true,
    assignedAgentId: targetType === 'agent' ? targetId : null,
    assignedBranchId: targetType === 'branch' ? targetId : null,
  };
}

/**
 * The G4 audit-diff fragment recording the routing outcome as before/after
 * pairs — a freshly created enquiry starts unassigned, so `before` is null.
 */
export function assignmentDiff(assignment: EnquiryAssignment): Record<string, unknown> {
  return {
    assignedAgentId: [null, assignment.assignedAgentId],
    assignedBranchId: [null, assignment.assignedBranchId],
  };
}
