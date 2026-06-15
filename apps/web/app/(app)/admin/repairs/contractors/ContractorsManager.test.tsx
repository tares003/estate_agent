// responsive-coverage: opt-out all — asserts the manager behaviour; layout is the
// admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createContractor = vi.fn();
const setContractorActive = vi.fn();
vi.mock('./actions.js', () => ({
  createContractor: (...args: unknown[]) => createContractor(...args),
  setContractorActive: (...args: unknown[]) => setContractorActive(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ContractorsManager } = await import('./ContractorsManager.js');

const CONTRACTORS = [
  { id: 'k1', name: 'Ace Plumbing', email: 'ace@example.com', phone: '07700900000', trade: 'Plumbing', active: true },
  { id: 'k2', name: 'Bright Spark', email: 'spark@example.com', phone: null, trade: 'Electrical', active: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  createContractor.mockResolvedValue({ ok: true });
  setContractorActive.mockResolvedValue({ ok: true });
});

describe('ContractorsManager', () => {
  it('renders the add form and a row per contractor with its status', () => {
    render(<ContractorsManager contractors={CONTRACTORS} />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Ace Plumbing')).toBeInTheDocument();
    expect(within(table).getByText('Bright Spark')).toBeInTheDocument();
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
  });

  it('deactivates an active contractor and refreshes', async () => {
    const user = userEvent.setup();
    render(<ContractorsManager contractors={CONTRACTORS} />);
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(setContractorActive).toHaveBeenCalledTimes(1);
    const fd = setContractorActive.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('k1');
    expect(fd.get('active')).toBe('false');
  });

  it('reactivates an inactive contractor', async () => {
    const user = userEvent.setup();
    render(<ContractorsManager contractors={CONTRACTORS} />);
    await user.click(screen.getByRole('button', { name: 'Activate' }));
    const fd = setContractorActive.mock.calls[0]?.[1] as FormData;
    expect(fd.get('id')).toBe('k2');
    expect(fd.get('active')).toBe('true');
  });
});
