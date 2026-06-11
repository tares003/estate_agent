// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setRepairStatus = vi.fn();
vi.mock('./actions.js', () => ({
  setRepairStatus: (...args: unknown[]) => setRepairStatus(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { RepairStatusControl } = await import('./RepairStatusControl.js');

beforeEach(() => {
  vi.clearAllMocks();
  setRepairStatus.mockResolvedValue({ ok: false });
});

describe('RepairStatusControl', () => {
  it('offers only the legal next statuses for the current state', () => {
    render(
      <RepairStatusControl
        repairId="r1"
        options={[
          { value: 'triaged', label: 'Triaged' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />,
    );
    const select = screen.getByLabelText(/Move to/i);
    const labels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toContain('Triaged');
    expect(labels).toContain('Rejected');
    expect(labels).not.toContain('Completed');
    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
  });

  it('tells a terminal ticket there is nowhere to move', () => {
    render(<RepairStatusControl repairId="r1" options={[]} />);
    expect(screen.getByText(/final state/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update status/i })).not.toBeInTheDocument();
  });

  it('submits the chosen status + notes and refreshes on success', async () => {
    setRepairStatus.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <RepairStatusControl repairId="r1" options={[{ value: 'triaged', label: 'Triaged' }]} />,
    );

    await user.selectOptions(screen.getByLabelText(/Move to/i), 'triaged');
    await user.click(screen.getByRole('button', { name: /Update status/i }));

    expect(setRepairStatus).toHaveBeenCalledTimes(1);
    const fd = setRepairStatus.mock.calls[0]?.[1] as FormData;
    expect(fd.get('repairId')).toBe('r1');
    expect(fd.get('to')).toBe('triaged');
    expect(refresh).toHaveBeenCalled();
  });
});
