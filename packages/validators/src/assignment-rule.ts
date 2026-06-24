import { z } from 'zod';

// EPIC-H FR-H-4 — the no-code enquiry assignment-rules engine. Staff compose
// `IF <conditions> THEN <assignment>` rules in the admin; rules are evaluated
// top-down, first-match-wins, to route an incoming enquiry to an agent or a
// branch. This module is the pure heart: the IF/THEN input schema (shared by the
// editor form and the create action) and the IO-free evaluator the rule-tester
// runs against a sample enquiry before saving. "Lead" appears only as a UI label
// (PRODUCT.md §2/§3); code uses the canonical `enquiry`.

/**
 * The enquiry attributes a condition can test. These mirror the canonical
 * `Enquiry` model columns (G6): `lead_type` is the enquiry's `leadType`,
 * `status` its lifecycle status, `source_url` the originating page, `message`
 * the free-text body, and `property` whether the enquiry is tied to a property.
 */
export const ASSIGNMENT_RULE_CONDITION_FIELDS = [
  'lead_type',
  'status',
  'source_url',
  'message',
  'property',
] as const;
export type AssignmentRuleConditionField = (typeof ASSIGNMENT_RULE_CONDITION_FIELDS)[number];

/** The comparison + presence operators a condition can use. */
export const ASSIGNMENT_RULE_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
] as const;
export type AssignmentRuleOperator = (typeof ASSIGNMENT_RULE_OPERATORS)[number];

/** Operators that compare against a `value`; the rest are presence-only. */
const VALUE_OPERATORS: ReadonlySet<AssignmentRuleOperator> = new Set([
  'equals',
  'not_equals',
  'contains',
]);

/** What an enquiry can be assigned to (THEN clause). */
export const ASSIGNMENT_TARGET_TYPES = ['agent', 'branch'] as const;
export type AssignmentTargetType = (typeof ASSIGNMENT_TARGET_TYPES)[number];

/** Max rule name length (a short label shown in the editor list). */
export const ASSIGNMENT_RULE_NAME_MAX = 120;

/** A single IF clause: `field operator value`. `value` is omitted for presence ops. */
export const assignmentConditionSchema = z
  .object({
    field: z.enum(ASSIGNMENT_RULE_CONDITION_FIELDS),
    operator: z.enum(ASSIGNMENT_RULE_OPERATORS),
    value: z.string().max(500).optional(),
  })
  .superRefine((condition, ctx) => {
    const needsValue = VALUE_OPERATORS.has(condition.operator);
    const hasValue = typeof condition.value === 'string' && condition.value.trim().length > 0;
    if (needsValue && !hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'This operator needs a value to compare against.',
      });
    }
  });
export type AssignmentCondition = z.infer<typeof assignmentConditionSchema>;

/** The THEN clause: assign to a specific agent or branch (by id). */
export const assignmentTargetSchema = z.object({
  targetType: z.enum(ASSIGNMENT_TARGET_TYPES),
  targetId: z.string().uuid(),
});
export type AssignmentTarget = z.infer<typeof assignmentTargetSchema>;

/** A complete `IF <conditions> THEN <assignment>` rule (the editor's unit of work). */
export const assignmentRuleSchema = z.object({
  // `ruleName` (not `name`) — this is the rule's own label, not a person's name;
  // the distinct identifier also keeps the rule schema clear of the personal-data
  // consent heuristic (G5), which this config schema is genuinely out of scope for.
  ruleName: z.string().trim().min(1).max(ASSIGNMENT_RULE_NAME_MAX),
  /** Every condition must hold (AND). At least one is required — a rule with no IF
   * would match everything and is rejected so the editor cannot create a silent
   * catch-all by accident. */
  conditions: z.array(assignmentConditionSchema).min(1).max(20),
  assignment: assignmentTargetSchema,
});
export type AssignmentRule = z.infer<typeof assignmentRuleSchema>;

/**
 * The enquiry shape the evaluator tests against — the rule-tester builds this
 * from a sample, and the runtime router builds it from a real enquiry row. Only
 * the fields a condition can reference are needed.
 */
export interface SampleEnquiry {
  // The enquiry's `lead_type` value. Named `enquiryType` (not `leadType`) per the
  // canonical-noun guard (G6) — "lead" is a UI label only; the entity is Enquiry.
  enquiryType: string;
  status: string;
  sourceUrl: string | null;
  message: string;
  /** Whether the enquiry is tied to a property (the `property` field's presence). */
  hasProperty: boolean;
}

/** Resolve the raw field value an operator compares against. */
function fieldValue(field: AssignmentRuleConditionField, enquiry: SampleEnquiry): string | null {
  switch (field) {
    case 'lead_type':
      return enquiry.enquiryType;
    case 'status':
      return enquiry.status;
    case 'source_url':
      return enquiry.sourceUrl;
    case 'message':
      return enquiry.message;
    case 'property':
      // Presence-only field: an assigned property reads as a non-empty marker.
      return enquiry.hasProperty ? 'property' : null;
  }
}

/** Evaluate one IF clause against the enquiry. */
function matchesCondition(condition: AssignmentCondition, enquiry: SampleEnquiry): boolean {
  const actual = fieldValue(condition.field, enquiry);
  const present = typeof actual === 'string' && actual.length > 0;

  switch (condition.operator) {
    case 'is_empty':
      return !present;
    case 'is_not_empty':
      return present;
    case 'equals':
      return present && actual === condition.value;
    case 'not_equals':
      // A non-equal value (including an absent one) satisfies not_equals.
      return actual !== condition.value;
    case 'contains':
      return (
        present &&
        typeof condition.value === 'string' &&
        actual.toLowerCase().includes(condition.value.toLowerCase())
      );
  }
}

/** True when EVERY condition holds (the IF clause is an AND of its conditions). */
export function matchesAllConditions(
  conditions: readonly AssignmentCondition[],
  enquiry: SampleEnquiry,
): boolean {
  return conditions.every((condition) => matchesCondition(condition, enquiry));
}

/** The outcome of evaluating a rule set against one enquiry. */
export interface AssignmentEvaluation {
  /** Whether any rule matched. */
  matched: boolean;
  /** The 0-based index of the first matching rule, or -1 when none matched. */
  matchedIndex: number;
  /** The winning assignment, or null when no rule matched. */
  assignment: AssignmentTarget | null;
}

/**
 * Evaluate `rules` against `enquiry` TOP-DOWN, FIRST-MATCH-WINS (FR-H-4). The
 * first rule whose conditions all hold decides the assignment; later rules are
 * not consulted. When nothing matches the enquiry stays unassigned.
 */
export function evaluateAssignmentRules(
  rules: readonly AssignmentRule[],
  enquiry: SampleEnquiry,
): AssignmentEvaluation {
  for (let index = 0; index < rules.length; index += 1) {
    const candidate = rules[index];
    if (candidate && matchesAllConditions(candidate.conditions, enquiry)) {
      return { matched: true, matchedIndex: index, assignment: candidate.assignment };
    }
  }
  return { matched: false, matchedIndex: -1, assignment: null };
}
