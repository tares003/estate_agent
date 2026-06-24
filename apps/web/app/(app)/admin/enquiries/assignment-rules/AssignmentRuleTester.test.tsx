// responsive-coverage: opt-out all — asserts the rule-tester behaviour (the
// first-match-wins evaluation result it surfaces); layout is the admin-routes
// Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssignmentRuleTester } from './AssignmentRuleTester.js';
import type { AssignmentRuleRow } from './assignment-rules-query.js';

const AGENT_A = '11111111-1111-1111-1111-111111111111';
const AGENT_B = '22222222-2222-2222-2222-222222222222';

const rules: AssignmentRuleRow[] = [
  {
    id: 'r1',
    name: 'New buyer enquiries to A',
    conditions: [
      { field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' },
      { field: 'status', operator: 'equals', value: 'new' },
    ],
    assignment: { targetType: 'agent', targetId: AGENT_A },
    position: 0,
    isEnabled: true,
  },
  {
    id: 'r2',
    name: 'All buyer enquiries to B',
    conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
    assignment: { targetType: 'agent', targetId: AGENT_B },
    position: 1,
    isEnabled: true,
  },
];

describe('AssignmentRuleTester (FR-H-4 — test against a sample before saving)', () => {
  it('reports the FIRST matching rule, not a later one (first-match-wins)', async () => {
    const user = userEvent.setup();
    render(<AssignmentRuleTester rules={rules} />);

    // The sample defaults to lead_type=buyer_enquiry, status=new — rule 1 wins.
    await user.click(screen.getByRole('button', { name: /test/i }));

    const result = screen.getByTestId('rule-tester-result');
    expect(result).toHaveTextContent('New buyer enquiries to A');
    expect(result).not.toHaveTextContent('All buyer enquiries to B');
  });

  it('falls through to a later rule when the first does not match', async () => {
    const user = userEvent.setup();
    render(<AssignmentRuleTester rules={rules} />);

    // Change status so rule 1 (status=new) no longer matches; rule 2 catches it.
    await user.selectOptions(screen.getByLabelText(/status/i), 'contacted');
    await user.click(screen.getByRole('button', { name: /test/i }));

    expect(screen.getByTestId('rule-tester-result')).toHaveTextContent('All buyer enquiries to B');
  });

  it('reports no match (enquiry stays unassigned) when nothing applies', async () => {
    const user = userEvent.setup();
    render(<AssignmentRuleTester rules={rules} />);

    await user.selectOptions(screen.getByLabelText(/lead type/i), 'tenant_enquiry');
    await user.click(screen.getByRole('button', { name: /test/i }));

    const result = screen.getByTestId('rule-tester-result');
    expect(result).toHaveTextContent(/no rule/i);
  });
});
