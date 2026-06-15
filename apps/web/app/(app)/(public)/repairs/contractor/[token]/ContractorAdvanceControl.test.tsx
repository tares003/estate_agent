// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// public-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const advanceRepairAsContractor = vi.fn();
vi.mock('./actions.js', () => ({
  advanceRepairAsContractor: (...args: unknown[]) => advanceRepairAsContractor(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ContractorAdvanceControl } = await import('./ContractorAdvanceControl.js');

beforeEach(() => {
  vi.clearAllMocks();
  advanceRepairAsContractor.mockResolvedValue({ ok: true });
});

describe('ContractorAdvanceControl', () => {
  it('renders the step label as the button and submits the token', async () => {
    const user = userEvent.setup();
    render(<ContractorAdvanceControl token="tok.en.sig" label="Start work" />);
    await user.click(screen.getByRole('button', { name: 'Start work' }));

    expect(advanceRepairAsContractor).toHaveBeenCalledTimes(1);
    const fd = advanceRepairAsContractor.mock.calls[0]?.[1] as FormData;
    expect(fd.get('token')).toBe('tok.en.sig');
  });

  it('confirms and refreshes after a successful advance', async () => {
    const user = userEvent.setup();
    render(<ContractorAdvanceControl token="tok.en.sig" label="Mark work complete" />);
    await user.click(screen.getByRole('button', { name: 'Mark work complete' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
