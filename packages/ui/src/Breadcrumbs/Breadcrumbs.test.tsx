// responsive-coverage: opt-out all — Breadcrumbs is a fluid inline trail; responsive layout is verified where it composes into page/organism tests
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs.js';

const TRAIL: BreadcrumbItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Properties', href: '/properties' },
  { label: '12 Acacia Avenue' },
];

describe('Breadcrumbs', () => {
  it('renders a navigation landmark labelled "Breadcrumb"', () => {
    render(<Breadcrumbs items={TRAIL} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('renders the trail as an ordered list with one item per crumb', () => {
    render(<Breadcrumbs items={TRAIL} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(TRAIL.length);
  });

  it('renders every crumb with an href as a link carrying that href', () => {
    render(<Breadcrumbs items={TRAIL} />);
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('href', '/');
    const properties = screen.getByRole('link', { name: 'Properties' });
    expect(properties).toHaveAttribute('href', '/properties');
  });

  it('renders the last crumb as plain text, not a link', () => {
    render(<Breadcrumbs items={TRAIL} />);
    expect(screen.queryByRole('link', { name: '12 Acacia Avenue' })).not.toBeInTheDocument();
    expect(screen.getByText('12 Acacia Avenue')).toBeInTheDocument();
  });

  it('marks the last crumb as the current page', () => {
    render(<Breadcrumbs items={TRAIL} />);
    const current = screen.getByText('12 Acacia Avenue');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('does not set aria-current on the linked ancestor crumbs', () => {
    render(<Breadcrumbs items={TRAIL} />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Properties' })).not.toHaveAttribute('aria-current');
  });

  it('renders any item without an href as current plain text, even mid-trail', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
      { label: 'Archived' },
      { label: 'Detail', href: '/detail' },
      { label: 'Edit' },
    ];
    render(<Breadcrumbs items={items} />);
    // the interior crumb with no href is rendered as current plain text
    const archived = screen.getByText('Archived');
    expect(archived).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Archived' })).not.toBeInTheDocument();
    // an interior crumb that does have an href is still a link
    expect(screen.getByRole('link', { name: 'Detail' })).toHaveAttribute('href', '/detail');
  });

  it('renders decorative separators between crumbs, hidden from assistive tech', () => {
    const { container } = render(<Breadcrumbs items={TRAIL} />);
    const separators = container.querySelectorAll('.breadcrumbs-separator');
    // one separator between each adjacent pair of crumbs
    expect(separators).toHaveLength(TRAIL.length - 1);
    separators.forEach((sep) => {
      expect(sep).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('renders no separator for a single-crumb trail', () => {
    const { container } = render(<Breadcrumbs items={[{ label: 'Home', href: '/' }]} />);
    expect(container.querySelectorAll('.breadcrumbs-separator')).toHaveLength(0);
  });

  it('merges a custom className onto the nav element', () => {
    render(<Breadcrumbs items={TRAIL} className="extra" />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveClass(
      'breadcrumbs',
      'extra',
    );
  });

  it('renders nothing for an empty trail', () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(<Breadcrumbs items={TRAIL} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
