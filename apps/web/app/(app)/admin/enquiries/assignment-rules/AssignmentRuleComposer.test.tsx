// responsive-coverage: opt-out all — asserts the composer behaviour (the IF/THEN
// payload it serialises to the action); layout is the admin-routes Playwright pass
// (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createAssignmentRule = vi.fn();
vi.mock('./actions.js', () => ({
  createAssignmentRule: (...args: unknown[]) => createAssignmentRule(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { AssignmentRuleComposer } = await import('./AssignmentRuleComposer.js');

const AGENT = '11111111-1111-1111-1111-111111111111';
const targets = [{ targetType: 'agent' as const, targetId: AGENT, label: 'Agent A' }];

beforeEach(() => {
  vi.clearAllMocks();
  createAssignmentRule.mockResolvedValue({ ok: true, ruleId: 'r1' });
});

describe('AssignmentRuleComposer (FR-H-4 — IF/THEN composition)', () => {
  it('serialises the name, conditions (JSON) and assignment (JSON) to the action', async () => {
    const user = userEvent.setup();
    render(<AssignmentRuleComposer targets={targets} />);

    await user.type(screen.getByLabelText(/rule name/i), 'Buyers to A');
    await user.selectOptions(screen.getByLabelText(/field/i), 'lead_type');
    await user.selectOptions(screen.getByLabelText(/operator/i), 'equals');
    await user.type(screen.getByLabelText(/value/i), 'buyer_enquiry');
    await user.selectOptions(screen.getByLabelText(/assign to/i), `agent:${AGENT}`);

    await user.click(screen.getByRole('button', { name: /save rule/i }));

    expect(createAssignmentRule).toHaveBeenCalledTimes(1);
    const fd = createAssignmentRule.mock.calls[0]?.[1] as FormData;
    expect(fd.get('name')).toBe('Buyers to A');
    expect(JSON.parse(String(fd.get('conditions')))).toEqual([
      { field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' },
    ]);
    expect(JSON.parse(String(fd.get('assignment')))).toEqual({
      targetType: 'agent',
      targetId: AGENT,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('lets the user add a second condition row (composition)', async () => {
    const user = userEvent.setup();
    render(<AssignmentRuleComposer targets={targets} />);

    expect(screen.getAllByLabelText(/field/i)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /add condition/i }));
    expect(screen.getAllByLabelText(/field/i)).toHaveLength(2);
  });

  it('surfaces an action error', async () => {
    createAssignmentRule.mockResolvedValue({
      ok: false,
      errors: [{ message: 'You do not have permission to manage assignment rules.' }],
    });
    const user = userEvent.setup();
    render(<AssignmentRuleComposer targets={targets} />);

    await user.type(screen.getByLabelText(/rule name/i), 'X');
    await user.selectOptions(screen.getByLabelText(/field/i), 'status');
    await user.selectOptions(screen.getByLabelText(/operator/i), 'equals');
    await user.type(screen.getByLabelText(/value/i), 'new');
    await user.selectOptions(screen.getByLabelText(/assign to/i), `agent:${AGENT}`);
    await user.click(screen.getByRole('button', { name: /save rule/i }));

    expect(
      await screen.findByText('You do not have permission to manage assignment rules.'),
    ).toBeInTheDocument();
  });
});
