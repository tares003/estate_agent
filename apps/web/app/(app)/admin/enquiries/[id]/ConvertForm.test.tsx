// responsive-coverage: opt-out all — asserts the convert-form behaviour; layout is
// the admin-routes Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const convertEnquiry = vi.fn();
vi.mock('../conversion-actions.js', () => ({
  convertEnquiry: (...args: unknown[]) => convertEnquiry(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { ConvertForm } = await import('./ConvertForm.js');

beforeEach(() => {
  vi.clearAllMocks();
  convertEnquiry.mockResolvedValue({ ok: false });
});

describe('ConvertForm', () => {
  it('offers the four contact types', () => {
    render(<ConvertForm enquiryId="e1" />);
    const select = screen.getByRole('combobox', { name: 'Contact type' });
    for (const label of ['Buyer', 'Tenant', 'Vendor', 'Landlord']) {
      expect(within(select).getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('converts with the chosen type, refreshes, and confirms on success', async () => {
    convertEnquiry.mockResolvedValue({ ok: true, contactId: 'c1' });
    const user = userEvent.setup();
    render(<ConvertForm enquiryId="e1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Contact type' }), 'vendor');
    await user.click(screen.getByRole('button', { name: 'Convert to contact' }));

    expect(convertEnquiry).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText('Converted to a contact.')).toBeInTheDocument();
  });

  it('surfaces an action error and does not refresh', async () => {
    convertEnquiry.mockResolvedValue({
      ok: false,
      errors: [{ message: 'An enquiry cannot be converted from new.' }],
    });
    const user = userEvent.setup();
    render(<ConvertForm enquiryId="e1" />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Contact type' }), 'buyer');
    await user.click(screen.getByRole('button', { name: 'Convert to contact' }));

    expect(await screen.findByText(/cannot be converted from new/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
