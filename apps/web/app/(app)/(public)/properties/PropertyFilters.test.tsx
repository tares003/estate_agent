// responsive-coverage: opt-out all — asserts the filter form's composition and
// that it pre-fills from the current filters; the responsive bar layout is
// covered by the page-level Playwright e2e pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PropertySearch } from '@estate/validators';
import { PropertyFilters } from './PropertyFilters.js';

const empty: PropertySearch = { sort: 'newest', page: 1, unit: 'mi' };

describe('PropertyFilters', () => {
  it('is a GET form to /properties carrying the core + radius controls', () => {
    const { container } = render(<PropertyFilters current={empty} />);

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/properties');

    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Buy or rent')).toBeInTheDocument();
    expect(screen.getByLabelText('Property type')).toBeInTheDocument();
    expect(screen.getByLabelText('Bedrooms')).toBeInTheDocument();
    expect(screen.getByLabelText('Bathrooms')).toBeInTheDocument();
    expect(screen.getByLabelText(/Min price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max price/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Distance')).toBeInTheDocument();
    expect(screen.getByLabelText('Unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Order by')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply filters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search near me/i })).toBeInTheDocument();
  });

  it('pre-fills each control from the current filters', () => {
    render(
      <PropertyFilters
        current={{
          location: 'M20',
          saleType: 'rent',
          listingType: 'residential',
          bedroomsMin: 2,
          priceMin: 100000,
          radius: 5,
          unit: 'km',
          sort: 'price_asc',
          page: 1,
        }}
      />,
    );

    expect(screen.getByLabelText('Location')).toHaveValue('M20');
    expect(screen.getByLabelText('Buy or rent')).toHaveValue('rent');
    expect(screen.getByLabelText('Property type')).toHaveValue('residential');
    expect(screen.getByLabelText('Bedrooms')).toHaveValue('2');
    expect(screen.getByLabelText(/Min price/i)).toHaveValue(100000);
    expect(screen.getByLabelText('Distance')).toHaveValue('5');
    expect(screen.getByLabelText('Unit')).toHaveValue('km');
    expect(screen.getByLabelText('Order by')).toHaveValue('price_asc');
  });

  it('controls carry the URL param names used by the query string', () => {
    const { container } = render(<PropertyFilters current={empty} />);
    for (const name of [
      'location',
      'saleType',
      'listingType',
      'bedroomsMin',
      'bathroomsMin',
      'priceMin',
      'priceMax',
      'radius',
      'unit',
      'lat',
      'lng',
      'sort',
    ]) {
      expect(container.querySelector(`[name="${name}"]`)).toBeInTheDocument();
    }
  });
});
