// responsive-coverage: opt-out all — asserts the control behaviour; layout is the
// admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setPropertyMarketStatus = vi.fn();
vi.mock('./market-status-actions.js', () => ({
  setPropertyMarketStatus: (...args: unknown[]) => setPropertyMarketStatus(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { MarketStatusControl } = await import('./MarketStatusControl.js');

const SALE_OPTIONS = ['for_sale', 'under_offer', 'sold_stc', 'sold', 'withdrawn'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  setPropertyMarketStatus.mockResolvedValue({ ok: false });
});

describe('MarketStatusControl', () => {
  it('offers the sale-type statuses, pre-set to the current one', () => {
    render(<MarketStatusControl propertyId="p1" current="under_offer" options={SALE_OPTIONS} />);
    const select = screen.getByRole('combobox', { name: 'Market status' });
    expect(select).toHaveValue('under_offer');
    expect(within(select).getByRole('option', { name: 'Sold STC' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Let' })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).toHaveValue('p1');
  });

  it('submits the chosen status and refreshes on success', async () => {
    setPropertyMarketStatus.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MarketStatusControl propertyId="p1" current="for_sale" options={SALE_OPTIONS} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Market status' }), 'sold');
    await user.click(screen.getByRole('button', { name: 'Update market status' }));

    expect(setPropertyMarketStatus).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
  });
});
