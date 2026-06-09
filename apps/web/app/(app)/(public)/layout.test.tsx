// responsive-coverage: opt-out all — the public shell's responsive layout is
// verified by the page-level Playwright e2e pass; this asserts nav structure +
// landmarks + the trust-marker footer note.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicLayout from './layout.js';

describe('PublicLayout', () => {
  it('renders a labelled primary nav with the core destinations', () => {
    render(
      <PublicLayout>
        <main>content</main>
      </PublicLayout>,
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toBeInTheDocument();
    for (const label of ['Buy', 'Rent', 'Sell', 'Contact']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('shows the indicative-pricing / rent-frequency trust note in the footer', () => {
    render(
      <PublicLayout>
        <main>content</main>
      </PublicLayout>,
    );
    expect(screen.getByText(/indicative only/i)).toBeInTheDocument();
    expect(screen.getByText(/PCM/)).toBeInTheDocument();
  });
});
