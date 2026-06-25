import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_RULE_CONDITION_FIELDS,
  ASSIGNMENT_RULE_OPERATORS,
  ASSIGNMENT_TARGET_TYPES,
  assignmentRuleSchema,
  evaluateAssignmentRules,
  matchesAllConditions,
  type AssignmentRule,
  type SampleEnquiry,
} from './assignment-rule.js';

const AGENT_A = '11111111-1111-1111-1111-111111111111';
const AGENT_B = '22222222-2222-2222-2222-222222222222';
const BRANCH = '33333333-3333-3333-3333-333333333333';

function rule(overrides: Partial<AssignmentRule> = {}): AssignmentRule {
  return {
    ruleName: 'Sales leads to agent A',
    conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
    assignment: { targetType: 'agent', targetId: AGENT_A },
    ...overrides,
  };
}

const enquiry: SampleEnquiry = {
  enquiryType: 'buyer_enquiry',
  status: 'new',
  sourceUrl: 'https://example.test/properties/flat',
  message: 'Interested in a viewing',
  hasProperty: true,
};

describe('assignmentRuleSchema (FR-H-4 — IF/THEN composition)', () => {
  it('accepts a well-formed IF/THEN rule', () => {
    const parsed = assignmentRuleSchema.safeParse(rule());
    expect(parsed.success).toBe(true);
  });

  it('exposes the canonical condition fields, operators and target types', () => {
    expect(ASSIGNMENT_RULE_CONDITION_FIELDS).toContain('lead_type');
    expect(ASSIGNMENT_RULE_CONDITION_FIELDS).toContain('status');
    expect(ASSIGNMENT_RULE_CONDITION_FIELDS).toContain('source_url');
    expect(ASSIGNMENT_RULE_CONDITION_FIELDS).toContain('property');
    expect(ASSIGNMENT_RULE_OPERATORS).toEqual(
      expect.arrayContaining(['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']),
    );
    expect(ASSIGNMENT_TARGET_TYPES).toEqual(['agent', 'branch']);
  });

  it('requires at least one condition (a rule with no IF matches everything — rejected)', () => {
    const parsed = assignmentRuleSchema.safeParse(rule({ conditions: [] }));
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown condition field', () => {
    const parsed = assignmentRuleSchema.safeParse(
      rule({ conditions: [{ field: 'colour', operator: 'equals', value: 'x' }] as never }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown operator', () => {
    const parsed = assignmentRuleSchema.safeParse(
      rule({ conditions: [{ field: 'status', operator: 'matches', value: 'x' }] as never }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-uuid assignment target id', () => {
    const parsed = assignmentRuleSchema.safeParse(
      rule({ assignment: { targetType: 'agent', targetId: 'not-a-uuid' } }),
    );
    expect(parsed.success).toBe(false);
  });

  it('requires a value for a comparison operator but not for a presence operator', () => {
    const needsValue = assignmentRuleSchema.safeParse(
      rule({ conditions: [{ field: 'status', operator: 'equals', value: '' }] }),
    );
    expect(needsValue.success).toBe(false);

    const presence = assignmentRuleSchema.safeParse(
      rule({ conditions: [{ field: 'source_url', operator: 'is_empty' }] }),
    );
    expect(presence.success).toBe(true);
  });
});

describe('matchesAllConditions (IF = AND of every condition)', () => {
  it('matches when every condition holds', () => {
    expect(
      matchesAllConditions(
        [
          { field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' },
          { field: 'status', operator: 'equals', value: 'new' },
        ],
        enquiry,
      ),
    ).toBe(true);
  });

  it('does not match when any single condition fails (AND, not OR)', () => {
    expect(
      matchesAllConditions(
        [
          { field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' },
          { field: 'status', operator: 'equals', value: 'contacted' },
        ],
        enquiry,
      ),
    ).toBe(false);
  });

  it('handles not_equals', () => {
    expect(
      matchesAllConditions([{ field: 'status', operator: 'not_equals', value: 'lost' }], enquiry),
    ).toBe(true);
  });

  it('handles contains (case-insensitive substring on free-text fields)', () => {
    expect(
      matchesAllConditions([{ field: 'message', operator: 'contains', value: 'VIEWING' }], enquiry),
    ).toBe(true);
    expect(
      matchesAllConditions([{ field: 'message', operator: 'contains', value: 'rental' }], enquiry),
    ).toBe(false);
  });

  it('evaluates the property field by assignment presence', () => {
    expect(matchesAllConditions([{ field: 'property', operator: 'is_not_empty' }], enquiry)).toBe(
      true,
    );
    expect(
      matchesAllConditions([{ field: 'property', operator: 'is_empty' }], {
        ...enquiry,
        hasProperty: false,
      }),
    ).toBe(true);
  });

  it('treats a missing source_url as empty for presence checks', () => {
    const noUrl: SampleEnquiry = { ...enquiry, sourceUrl: null };
    expect(matchesAllConditions([{ field: 'source_url', operator: 'is_empty' }], noUrl)).toBe(true);
    expect(matchesAllConditions([{ field: 'source_url', operator: 'is_not_empty' }], noUrl)).toBe(
      false,
    );
  });
});

describe('evaluateAssignmentRules (top-down first-match-wins)', () => {
  it('returns the first matching rule, not a later one', () => {
    const rules: AssignmentRule[] = [
      rule({
        ruleName: 'New buyer enquiries to A',
        conditions: [{ field: 'status', operator: 'equals', value: 'new' }],
        assignment: { targetType: 'agent', targetId: AGENT_A },
      }),
      rule({
        ruleName: 'All buyer enquiries to B',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
        assignment: { targetType: 'agent', targetId: AGENT_B },
      }),
    ];
    const result = evaluateAssignmentRules(rules, enquiry);
    expect(result.matched).toBe(true);
    expect(result.matchedIndex).toBe(0);
    expect(result.assignment).toEqual({ targetType: 'agent', targetId: AGENT_A });
  });

  it('falls through to a later rule when the earlier ones do not match', () => {
    const rules: AssignmentRule[] = [
      rule({
        ruleName: 'Lettings to branch',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'tenant_enquiry' }],
        assignment: { targetType: 'branch', targetId: BRANCH },
      }),
      rule({
        ruleName: 'Buyer to A',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
        assignment: { targetType: 'agent', targetId: AGENT_A },
      }),
    ];
    const result = evaluateAssignmentRules(rules, enquiry);
    expect(result.matched).toBe(true);
    expect(result.matchedIndex).toBe(1);
    expect(result.assignment).toEqual({ targetType: 'agent', targetId: AGENT_A });
  });

  it('reports no match when nothing applies (the enquiry stays unassigned)', () => {
    const rules: AssignmentRule[] = [
      rule({
        conditions: [{ field: 'status', operator: 'equals', value: 'lost' }],
      }),
    ];
    const result = evaluateAssignmentRules(rules, enquiry);
    expect(result.matched).toBe(false);
    expect(result.matchedIndex).toBe(-1);
    expect(result.assignment).toBeNull();
  });

  it('treats an empty rule set as no match', () => {
    const result = evaluateAssignmentRules([], enquiry);
    expect(result.matched).toBe(false);
  });
});
