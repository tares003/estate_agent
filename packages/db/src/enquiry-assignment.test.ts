import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

// EPIC-I FR-I-3 (master spec §I.2 `assigned_user_id` / §I.4 assignment rules) —
// audit finding assignment-rules-never-applied: the Enquiry model must carry
// columns to PERSIST the routing outcome, or an evaluated rule has nowhere to
// land. The committed AssignmentTarget union is agent|branch (the §I.4 examples
// route to a person OR a branch rota), so the persisted result is a pair of soft
// references (matching Property.primaryAgentId — no hard FK, the enquiry
// survives an agent leaving): at most one is set; both null while unassigned.
//
// Schema-source assertions (mirrors core-entities.test.ts): the enquiries table
// is already under RLS + tenant_isolation (migration 0003), which covers new
// columns on the same table — no raw-SQL change is needed here.

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8');

function modelBlock(model: string): string {
  const re = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`, 'm');
  const match = schema.match(re);
  expect(match, `model ${model} should be declared`).not.toBeNull();
  return match![0];
}

describe('Enquiry assignment columns (FR-I-3)', () => {
  it('persists the routed agent as a nullable soft uuid reference', () => {
    const block = modelBlock('Enquiry');
    expect(block).toMatch(/assignedAgentId\s+String\?\s+@map\("assigned_agent_id"\)\s+@db\.Uuid/);
  });

  it('persists a branch-target routing outcome as a nullable soft uuid reference', () => {
    const block = modelBlock('Enquiry');
    expect(block).toMatch(
      /assignedBranchId\s+String\?\s+@map\("assigned_branch_id"\)\s+@db\.Uuid/,
    );
  });

  it('keeps both assignment references SOFT (no @relation binds an assignee)', () => {
    const block = modelBlock('Enquiry');
    // The enquiry must survive an agent or branch being removed; only tenant and
    // property bind relationally (as before).
    expect(block).not.toMatch(/assignedAgent\s+Agent/);
    expect(block).not.toMatch(/assignedBranch\s+Branch/);
  });
});
