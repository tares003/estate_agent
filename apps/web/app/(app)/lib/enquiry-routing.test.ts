import { describe, expect, it, vi } from 'vitest';

import { assignmentDiff, resolveEnquiryAssignment } from './enquiry-routing.js';

// EPIC-I FR-I-3 (audit finding assignment-rules-never-applied) — the runtime
// router every enquiry-creation action calls inside its tenant tx: load the
// tenant's ENABLED assignment rules in evaluation order (position ascending),
// evaluate them top-down first-match-wins via @estate/validators'
// evaluateAssignmentRules, and hand back the columns to persist. Unmatched
// enquiries stay unassigned (both references null).

const AGENT = '00000000-0000-0000-0000-00000000000a';
const BRANCH = '00000000-0000-0000-0000-00000000000b';

interface RuleRow {
  name: string;
  conditions: unknown;
  assignment: unknown;
}

function reader(rows: RuleRow[]) {
  const findMany = vi.fn(async () => rows);
  return { client: { assignmentRule: { findMany } }, findMany };
}

const sample = {
  enquiryType: 'general_contact',
  status: 'new',
  sourceUrl: null,
  message: 'Do you cover the Didsbury area?',
  hasProperty: false,
};

describe('resolveEnquiryAssignment', () => {
  it('queries only ENABLED rules in evaluation order (position ascending)', async () => {
    const { client, findMany } = reader([]);
    await resolveEnquiryAssignment(client, sample);

    expect(findMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
      orderBy: { position: 'asc' },
    });
  });

  it('persists the first-match agent target as assignedAgentId (first-match-wins)', async () => {
    const { client } = reader([
      {
        name: 'General contact to Alex',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'general_contact' }],
        assignment: { targetType: 'agent', targetId: AGENT },
      },
      {
        name: 'Catch-all to branch',
        conditions: [{ field: 'message', operator: 'is_not_empty' }],
        assignment: { targetType: 'branch', targetId: BRANCH },
      },
    ]);

    const routing = await resolveEnquiryAssignment(client, sample);

    expect(routing).toEqual({ matched: true, assignedAgentId: AGENT, assignedBranchId: null });
  });

  it('persists a branch target as assignedBranchId', async () => {
    const { client } = reader([
      {
        name: 'Everything to the branch',
        conditions: [{ field: 'message', operator: 'is_not_empty' }],
        assignment: { targetType: 'branch', targetId: BRANCH },
      },
    ]);

    const routing = await resolveEnquiryAssignment(client, sample);

    expect(routing).toEqual({ matched: true, assignedAgentId: null, assignedBranchId: BRANCH });
  });

  it('leaves an unmatched enquiry unassigned (both references null)', async () => {
    const { client } = reader([
      {
        name: 'Valuations only',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'valuation_request' }],
        assignment: { targetType: 'agent', targetId: AGENT },
      },
    ]);

    const routing = await resolveEnquiryAssignment(client, sample);

    expect(routing).toEqual({ matched: false, assignedAgentId: null, assignedBranchId: null });
  });

  it('routes with no rules configured without failing (stays unassigned)', async () => {
    const { client } = reader([]);
    const routing = await resolveEnquiryAssignment(client, sample);
    expect(routing).toEqual({ matched: false, assignedAgentId: null, assignedBranchId: null });
  });

  it('skips a stored row that no longer parses and still applies a later valid rule', async () => {
    const { client } = reader([
      {
        name: 'Corrupt',
        conditions: 'not-an-array',
        assignment: { targetType: 'agent', targetId: AGENT },
      },
      {
        name: 'Valid catch-all',
        conditions: [{ field: 'message', operator: 'is_not_empty' }],
        assignment: { targetType: 'agent', targetId: AGENT },
      },
    ]);

    const routing = await resolveEnquiryAssignment(client, sample);

    expect(routing).toEqual({ matched: true, assignedAgentId: AGENT, assignedBranchId: null });
  });
});

describe('assignmentDiff', () => {
  it('records the routing outcome as before/after pairs for the audit diff (G4)', () => {
    expect(
      assignmentDiff({ matched: true, assignedAgentId: AGENT, assignedBranchId: null }),
    ).toEqual({
      assignedAgentId: [null, AGENT],
      assignedBranchId: [null, null],
    });
  });
});
