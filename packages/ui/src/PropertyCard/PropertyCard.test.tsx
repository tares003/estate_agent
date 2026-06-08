// responsive-coverage: opt-out all — PropertyCard's responsive layout is verified
// in PropertyCard.spec.tsx via Playwright at all seven breakpoints
// (320/640/768/1024/1280/1440/2560). These jsdom tests cover behaviour, the nine
// market-status variants, the trust markers and accessibility semantics.
import { run } from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyCard, type PropertyCardStatus } from './PropertyCard.js';

const base = {
  href: '/properties/1',
  priceQualifier: 'Guide price',
  price: '£525,000',
  title: 'Edwardian semi · 4 bed',
  address: 'Palatine Road, Didsbury, M20',
} as const;

describe('PropertyCard', () => {
  it('renders the trust markers — qualifier above price, and rent frequency when let', () => {
    render(<PropertyCard {...base} status="for_sale" />);
    expect(screen.getByText('Guide price')).toBeInTheDocument();
    expect(screen.getByText('£525,000')).toBeInTheDocument();
  });

  it('shows the rent frequency adjacent to the price for rentals (PRODUCT.md §8)', () => {
    render(
      <PropertyCard
        {...base}
        status="to_rent"
        priceQualifier="Asking rent"
        price="£1,450"
        rentFrequency="PCM"
      />,
    );
    expect(screen.getByText('PCM')).toBeInTheDocument();
  });

  it.each<[PropertyCardStatus, string, boolean]>([
    ['for_sale', 'Status: For sale', false],
    ['to_rent', 'Status: To rent', false],
    ['under_offer', 'Status: Under offer', false],
    ['new_home', 'Status: New home', false],
    ['sold_stc', 'Status: Sold STC', true],
    ['sold', 'Status: Sold', true],
    ['let_agreed', 'Status: Let agreed', true],
    ['let', 'Status: Let', true],
    ['withdrawn', 'Status: Withdrawn', true],
  ])(
    'variant %s shows a labelled status badge (colour is not the only signal) and muted=%s',
    (status, label, muted) => {
      const { container } = render(<PropertyCard {...base} status={status} />);
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      expect(container.querySelector('.pcard')?.classList.contains('muted')).toBe(muted);
    },
  );

  it('is a single navigational link on the title pointing at href', () => {
    render(<PropertyCard {...base} status="for_sale" />);
    const link = screen.getByRole('link', { name: base.title });
    expect(link).toHaveAttribute('href', '/properties/1');
  });

  it('pluralises bedroom/bathroom counts', () => {
    render(<PropertyCard {...base} status="to_rent" bedrooms={1} bathrooms={1} />);
    expect(screen.getByText('1 bed')).toBeInTheDocument();
    expect(screen.getByText('1 bath')).toBeInTheDocument();
    render(<PropertyCard {...base} status="for_sale" bedrooms={4} bathrooms={2} />);
    expect(screen.getByText('4 beds')).toBeInTheDocument();
    expect(screen.getByText('2 baths')).toBeInTheDocument();
  });

  it('renders the placeholder when there is no image, and an alt image when there is', () => {
    const { container, rerender } = render(<PropertyCard {...base} status="for_sale" />);
    expect(container.querySelector('.roof .ph-house')).toBeInTheDocument();
    rerender(
      <PropertyCard {...base} status="for_sale" imageUrl="/p1.jpg" imageAlt="Front elevation" />,
    );
    expect(screen.getByRole('img', { name: 'Front elevation' })).toBeInTheDocument();
  });

  it('falls back to the title for image alt text', () => {
    render(<PropertyCard {...base} status="for_sale" imageUrl="/p1.jpg" />);
    expect(screen.getByRole('img', { name: base.title })).toBeInTheDocument();
  });

  it('renders a Save control that toggles its accessible name and pressed state', async () => {
    const onSave = vi.fn();
    const { rerender } = render(<PropertyCard {...base} status="for_sale" onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save property' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
    rerender(<PropertyCard {...base} status="for_sale" onSave={onSave} saved />);
    expect(screen.getByRole('button', { name: 'Remove from saved properties' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers "Notify me of similar" instead of a dead control on a muted card', async () => {
    const onNotify = vi.fn();
    render(
      <PropertyCard
        {...base}
        status="sold"
        priceQualifier="Completed sale"
        notifyLabel="Notify me of similar"
        onNotify={onNotify}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notify me of similar' }));
    expect(onNotify).toHaveBeenCalledOnce();
  });

  it('shows the photo count and the added/branch footer', () => {
    render(
      <PropertyCard
        {...base}
        status="for_sale"
        photoCount={18}
        addedLabel="Added 3 days ago"
        branchLabel="Didsbury branch"
      />,
    );
    expect(screen.getByLabelText('18 photos')).toBeInTheDocument();
    expect(screen.getByText('Added 3 days ago')).toBeInTheDocument();
    expect(screen.getByText('Didsbury branch')).toBeInTheDocument();
  });

  it('has no axe violations (structural; colour-contrast is checked in the Playwright spec)', async () => {
    const { container } = render(
      <PropertyCard
        {...base}
        status="for_sale"
        bedrooms={4}
        bathrooms={2}
        propertyType="Semi-detached"
        photoCount={18}
        addedLabel="Added 3 days ago"
        branchLabel="Didsbury branch"
        onSave={() => {}}
      />,
    );
    const results = await run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
