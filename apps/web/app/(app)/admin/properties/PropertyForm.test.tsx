// responsive-coverage: opt-out all — asserts the create/edit form pre-fill + submit
// (create→navigate, edit→refresh) + field-error surfacing; layout is the admin-routes
// Playwright pass (design-requirements §3).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import type { PropertyWriteState } from './actions.js';

const { PropertyForm } = await import('./PropertyForm.js');

/** A typed action mock: `(prevState, formData) => Promise<state>` so `.calls[0][1]` is FormData. */
function makeAction(result: PropertyWriteState) {
  return vi.fn(
    async (_prev: PropertyWriteState, _formData: FormData): Promise<PropertyWriteState> => result,
  );
}

const initial = {
  id: '11111111-1111-1111-1111-111111111111',
  reference: 'REF-001',
  listingType: 'residential',
  saleType: 'sale',
  slug: 'charming-two-bed-flat-chorlton-m21',
  title: 'Charming Two-Bed Flat',
  price: 35_000_000, // pence → £350,000
  priceQualifier: 'guide_price',
  marketStatus: 'for_sale',
  bedrooms: 2,
  bathrooms: 1,
  category: 'flat',
  tenure: 'leasehold',
  councilTaxBand: 'b',
  epcRating: 'c',
  displayAddress: '12 Acacia Avenue, Chorlton',
  postcode: 'M21 9WN',
  town: 'Chorlton',
  description: 'A charming flat.',
  keyFeatures: ['Two bedrooms', 'Allocated parking'],
  metaTitle: 'Two-bed flat in Chorlton',
  metaDescription: 'A lovely two-bed flat.',
  publicationStatus: 'draft',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PropertyForm — create mode', () => {
  it('renders the core sections and the required identification fields', () => {
    const action = makeAction({ ok: false });
    render(<PropertyForm mode="create" action={action} />);

    // Labelled sections (rendered as fieldset legends).
    expect(screen.getByText('Identification')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Specification')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();

    // The reference field only exists in create mode; defaults for the required enums.
    expect(screen.getByLabelText(/Reference/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Listing type/i)).toHaveValue('residential');
    expect(screen.getByLabelText(/Sale type/i)).toHaveValue('sale');
    expect(screen.getByRole('button', { name: 'Create property' })).toBeInTheDocument();
  });

  it('submits the entered core fields and navigates to the new listing on success', async () => {
    const action = makeAction({ ok: true, id: 'new-prop-id', slug: 'flat-chorlton' });
    const user = userEvent.setup();
    render(<PropertyForm mode="create" action={action} />);

    await user.type(screen.getByLabelText(/Reference/i), 'REF-9');
    await user.type(screen.getByLabelText(/Display address/i), '5 New Street, Chorlton');
    await user.type(screen.getByLabelText(/Postcode/i), 'M21 9WN');
    await user.click(screen.getByRole('button', { name: 'Create property' }));

    // Await the post-success navigation (the effect fires after the action resolves).
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/properties/new-prop-id'));

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]![1] as FormData;
    expect(formData.get('reference')).toBe('REF-9');
    expect(formData.get('displayAddress')).toBe('5 New Street, Chorlton');
    expect(formData.get('postcode')).toBe('M21 9WN');
    expect(formData.get('listingType')).toBe('residential');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('PropertyForm — edit mode', () => {
  it('pre-fills every core field from the listing (price shown in £)', () => {
    const action = makeAction({ ok: false });
    render(<PropertyForm mode="edit" action={action} initial={initial} />);

    expect(screen.getByLabelText('Title')).toHaveValue('Charming Two-Bed Flat');
    expect(screen.getByLabelText(/URL slug/i)).toHaveValue('charming-two-bed-flat-chorlton-m21');
    expect(screen.getByLabelText('Price (£)')).toHaveValue(350000);
    expect(screen.getByLabelText(/Bedrooms/i)).toHaveValue(2);
    expect(screen.getByLabelText(/Display address/i)).toHaveValue('12 Acacia Avenue, Chorlton');
    expect(screen.getByLabelText(/Postcode/i)).toHaveValue('M21 9WN');
    expect(screen.getByLabelText(/Price qualifier/i)).toHaveValue('guide_price');
    expect(screen.getByLabelText(/Category/i)).toHaveValue('flat');
    expect(screen.getByLabelText(/Tenure/i)).toHaveValue('leasehold');
    expect(screen.getByLabelText(/Publication status/i)).toHaveValue('draft');
    expect(screen.getByLabelText(/Key features/i)).toHaveValue('Two bedrooms\nAllocated parking');
    // No reference field in edit mode; the row id is a hidden field.
    expect(screen.queryByLabelText(/Reference/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="id"]')).toHaveValue(initial.id);
  });

  it('submits the row id + edited core values and refreshes on success', async () => {
    const action = makeAction({ ok: true, id: initial.id, slug: initial.slug });
    const user = userEvent.setup();
    render(<PropertyForm mode="edit" action={action} initial={initial} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // Await the success render before asserting on the router (the effect is async).
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]![1] as FormData;
    expect(formData.get('id')).toBe(initial.id);
    expect(formData.get('title')).toBe('Charming Two-Bed Flat');
    // Key features arrive as one field per feature (the action calls getAll).
    expect(formData.getAll('keyFeatures')).toEqual(['Two bedrooms', 'Allocated parking']);
    // The optional enums submit their real values.
    expect(formData.get('priceQualifier')).toBe('guide_price');
    expect(formData.get('publicationStatus')).toBe('draft');
    expect(push).not.toHaveBeenCalled();
  });

  it('omits an optional enum from the submission when it is left unset', async () => {
    const action = makeAction({ ok: false });
    const user = userEvent.setup();
    render(
      <PropertyForm
        mode="edit"
        action={action}
        initial={{ ...initial, priceQualifier: null, category: null }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0]![1] as FormData;
    // "— Not set —" submits nothing (not an empty string) so the write schema sees undefined.
    expect(formData.has('priceQualifier')).toBe(false);
    expect(formData.has('category')).toBe(false);
  });

  it('renders the care-home extension fields when the pack is enabled (FR-F-3)', () => {
    const action = makeAction({ ok: false });
    render(
      <PropertyForm
        mode="edit"
        action={action}
        initial={{ ...initial, listingType: 'care_home' }}
        enabledVerticals={['care_home']}
        verticalInitial={{
          bedCount: 40,
          cqcRating: 'good',
          cqcInspectionUrl: null,
          isGoingConcern: false,
        }}
      />,
    );
    expect(screen.getByText('Care home details')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bed count/i)).toHaveValue(40);
  });

  it('omits the extension fields when the owning pack is not enabled', () => {
    const action = makeAction({ ok: false });
    render(
      <PropertyForm
        mode="edit"
        action={action}
        initial={{ ...initial, listingType: 'care_home' }}
        enabledVerticals={[]}
      />,
    );
    expect(screen.queryByText('Care home details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Bed count/i)).not.toBeInTheDocument();
  });

  it('surfaces the action field errors as in-page links and does not navigate', async () => {
    const action = makeAction({
      ok: false,
      errors: [{ field: 'postcode', message: 'Enter a valid UK postcode.' }],
    });
    const user = userEvent.setup();
    render(<PropertyForm mode="edit" action={action} initial={initial} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // The error-summary renders each field-linked error as an in-page anchor.
    const link = await screen.findByRole('link', { name: /Enter a valid UK postcode/i });
    expect(link).toHaveAttribute('href', '#postcode');
    expect(refresh).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
