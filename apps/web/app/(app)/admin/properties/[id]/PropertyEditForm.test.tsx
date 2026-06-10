// responsive-coverage: opt-out all — asserts the form pre-fill + submit/refresh +
// error states; layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateProperty = vi.fn();
vi.mock('./actions.js', () => ({
  updateProperty: (...args: unknown[]) => updateProperty(...args),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { PropertyEditForm } = await import('./PropertyEditForm.js');

const property = {
  id: 'p1',
  title: 'Edwardian semi',
  displayAddress: 'Palatine Road, Didsbury',
  postcode: 'M20 6RE',
  price: 52_500_000,
  bedrooms: 4,
  bathrooms: 2,
  receptions: 2,
  description: 'A handsome semi.',
};

beforeEach(() => {
  vi.clearAllMocks();
  updateProperty.mockResolvedValue({ ok: false });
});

describe('PropertyEditForm', () => {
  it('pre-fills the fields from the listing (price shown in £)', () => {
    render(<PropertyEditForm property={property} />);
    expect(screen.getByLabelText(/Display address/i)).toHaveValue('Palatine Road, Didsbury');
    expect(screen.getByLabelText(/Postcode/i)).toHaveValue('M20 6RE');
    expect(screen.getByLabelText(/Price/i)).toHaveValue(525000); // 52,500,000 pence → £525,000
    expect(screen.getByLabelText(/Bedrooms/i)).toHaveValue(4);
    expect(document.querySelector('input[name="id"]')).toHaveValue('p1');
  });

  it('leaves the price blank for a POA listing', () => {
    render(<PropertyEditForm property={{ ...property, price: null, bedrooms: null }} />);
    expect(screen.getByLabelText(/Price/i)).toHaveValue(null);
  });

  it('saves and refreshes on success', async () => {
    updateProperty.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PropertyEditForm property={property} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateProperty).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
  });

  it('surfaces the action errors and does not refresh', async () => {
    updateProperty.mockResolvedValue({
      ok: false,
      errors: [{ field: 'postcode', message: 'Enter a valid UK postcode.' }],
    });
    const user = userEvent.setup();
    render(<PropertyEditForm property={property} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const link = await screen.findByRole('link', { name: /Enter a valid UK postcode/i });
    expect(link).toHaveAttribute('href', '#postcode');
    expect(refresh).not.toHaveBeenCalled();
  });
});
