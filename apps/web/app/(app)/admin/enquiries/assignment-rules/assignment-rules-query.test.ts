import { describe, expect, it, vi } from 'vitest';

import {
  listAssignmentRules,
  listAssignmentTargets,
  type AssignmentRulesReader,
  type AssignmentTargetsReader,
} from './assignment-rules-query.js';

const AGENT = '11111111-1111-1111-1111-111111111111';
const BRANCH = '22222222-2222-2222-2222-222222222222';

function reader(rows: unknown[]): { reader: AssignmentRulesReader; findMany: ReturnType<typeof vi.fn> } {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { reader: { assignmentRule: { findMany } }, findMany };
}

describe('listAssignmentRules (FR-H-4 read model)', () => {
  it('lists the tenant rules in evaluation order (position ascending)', async () => {
    const { reader: r, findMany } = reader([
      {
        id: 'a',
        name: 'Buyers to A',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
        assignment: { targetType: 'agent', targetId: AGENT },
        position: 0,
        isEnabled: true,
      },
    ]);

    const rules = await listAssignmentRules(r);

    expect(findMany).toHaveBeenCalledWith({ orderBy: { position: 'asc' } });
    expect(rules).toHaveLength(1);
    expect(rules[0]?.name).toBe('Buyers to A');
    expect(rules[0]?.position).toBe(0);
  });

  it('returns an empty list when the tenant has no rules', async () => {
    const { reader: r } = reader([]);
    expect(await listAssignmentRules(r)).toEqual([]);
  });
});

describe('listAssignmentTargets (FR-H-4 — THEN picker options)', () => {
  it('lists active agents then branches as labelled targets', async () => {
    const agentFindMany = vi
      .fn()
      .mockResolvedValue([{ id: AGENT, name: 'Agent A' }]);
    const branchFindMany = vi
      .fn()
      .mockResolvedValue([{ id: BRANCH, name: 'High Street' }]);
    const r: AssignmentTargetsReader = {
      agent: { findMany: agentFindMany },
      branch: { findMany: branchFindMany },
    };

    const targets = await listAssignmentTargets(r);

    // Only active agents/branches are offered as routing targets.
    expect(agentFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(branchFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(targets).toEqual([
      { targetType: 'agent', targetId: AGENT, label: 'Agent A' },
      { targetType: 'branch', targetId: BRANCH, label: 'High Street (branch)' },
    ]);
  });
});
