// responsive-coverage: opt-out all — asserts the page shell + metadata; the form
// is covered by ValuationForm.test, and responsive layout by the Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));
// The form is a client component (useActionState) — stub it so the page test
// focuses on the shell.
vi.mock('./ValuationForm.js', () => ({
  ValuationForm: () => <div data-testid="valuation-form" />,
}));

const { default: ValuationPage, generateMetadata } = await import('./page.js');

describe('ValuationPage', () => {
  it('renders the heading + the valuation form', () => {
    render(<ValuationPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Book a free valuation' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('valuation-form')).toBeInTheDocument();
  });

  it('builds canonical metadata for the valuation page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/valuation');
    expect(meta.title).toBe('Book a free valuation');
  });
});
