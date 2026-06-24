import { describe, expect, it, vi } from 'vitest';

import { listAssignmentRules, type AssignmentRulesReader } from './assignment-rules-query.js';

const AGENT = '11111111-1111-1111-1111-111111111111';

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
