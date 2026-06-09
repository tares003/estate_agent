// responsive-coverage: opt-out all — page-level responsive layout and route-level
// axe/perf are verified by a Playwright e2e pass against the running app (a
// follow-on, like the @estate/ui CT harness). These jsdom tests assert content,
// landmarks and heading structure.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page.js';

describe('HomePage', () => {
  it('renders the hero heading and the primary calls to action as navigating links', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Move with people/i }),
    ).toBeInTheDocument();
    // The CTAs must navigate — they are links, not inert buttons.
    expect(screen.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
    expect(screen.getByRole('link', { name: 'Get a free valuation' })).toHaveAttribute(
      'href',
      '/valuation',
    );
  });

  it('exposes a main landmark and a section heading hierarchy', () => {
    render(<HomePage />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'How we help' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(3);
  });
});
