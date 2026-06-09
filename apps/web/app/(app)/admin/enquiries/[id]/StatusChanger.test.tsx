// responsive-coverage: opt-out all — asserts the form behaviour (options, the
// lost-reason reveal, submit + refresh, error surfacing); layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateEnquiryStatus = vi.fn();
vi.mock('../actions.js', () => ({
  updateEnquiryStatus: (...args: unknown[]) => updateEnquiryStatus(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { StatusChanger } = await import('./StatusChanger.js');

const OPTIONS = [
  { value: 'contacted' as const, label: 'Contacted' },
  { value: 'lost' as const, label: 'Lost' },
];

beforeEach(() => {
  vi.clearAllMocks();
  updateEnquiryStatus.mockResolvedValue({ ok: false });
});

describe('StatusChanger', () => {
  it('offers only the legal next statuses', () => {
    render(<StatusChanger enquiryId="e1" options={OPTIONS} />);
    const select = screen.getByRole('combobox', { name: 'Move to' });
    expect(within(select).getByRole('option', { name: 'Contacted' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Lost' })).toBeInTheDocument();
  });

  it('reveals the reason field only when moving to lost', async () => {
    const user = userEvent.setup();
    render(<StatusChanger enquiryId="e1" options={OPTIONS} />);

    expect(screen.queryByRole('combobox', { name: 'Reason' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Move to' }), 'lost');
    expect(screen.getByRole('combobox', { name: 'Reason' })).toBeInTheDocument();
  });

  it('submits the chosen status and refreshes on success', async () => {
    updateEnquiryStatus.mockResolvedValue({ ok: true, status: 'contacted' });
    const user = userEvent.setup();
    render(<StatusChanger enquiryId="e1" options={OPTIONS} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Move to' }), 'contacted');
    await user.click(screen.getByRole('button', { name: 'Update status' }));

    expect(updateEnquiryStatus).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });

  it('surfaces the action errors and does not refresh', async () => {
    updateEnquiryStatus.mockResolvedValue({
      ok: false,
      errors: [{ message: 'An enquiry cannot move from new to converted.' }],
    });
    const user = userEvent.setup();
    render(<StatusChanger enquiryId="e1" options={OPTIONS} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Move to' }), 'contacted');
    await user.click(screen.getByRole('button', { name: 'Update status' }));

    expect(await screen.findByText(/cannot move from new to converted/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows a terminal message when there are no further transitions', () => {
    render(<StatusChanger enquiryId="e1" options={[]} />);
    expect(screen.getByText('No further status changes available.')).toBeInTheDocument();
  });
});
