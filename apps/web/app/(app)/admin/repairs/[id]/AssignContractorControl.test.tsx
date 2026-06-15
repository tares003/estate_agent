// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const assignContractor = vi.fn();
vi.mock('./assign-actions.js', () => ({
  assignContractor: (...args: unknown[]) => assignContractor(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { AssignContractorControl } = await import('./AssignContractorControl.js');

const CONTRACTORS = [
  { id: 'k1', name: 'Ace Plumbing' },
  { id: 'k2', name: 'Bright Spark' },
];

beforeEach(() => {
  vi.clearAllMocks();
  assignContractor.mockResolvedValue({ ok: true });
});

describe('AssignContractorControl', () => {
  it('shows the current assignee and the contractor options', () => {
    render(
      <AssignContractorControl
        repairId="r1"
        contractors={CONTRACTORS}
        assignedContractorName="Ace Plumbing"
      />,
    );
    expect(screen.getByText('Assigned to Ace Plumbing.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bright Spark' })).toBeInTheDocument();
  });

  it('points to the directory when there are no active contractors', () => {
    render(
      <AssignContractorControl repairId="r1" contractors={[]} assignedContractorName={null} />,
    );
    expect(screen.getByText(/No contractor assigned yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Add an active contractor in the directory/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assign/i })).not.toBeInTheDocument();
  });

  it('submits the chosen contractor and refreshes on success', async () => {
    const user = userEvent.setup();
    render(
      <AssignContractorControl
        repairId="r1"
        contractors={CONTRACTORS}
        assignedContractorName={null}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Assign to/i), 'k2');
    await user.click(screen.getByRole('button', { name: /Assign/i }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(assignContractor).toHaveBeenCalledTimes(1);
  });
});
