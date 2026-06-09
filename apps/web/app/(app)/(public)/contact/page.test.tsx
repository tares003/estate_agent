// responsive-coverage: opt-out all — asserts the page shell + metadata; the form is
// covered by ContactForm.test, and responsive layout by the Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));
vi.mock('./ContactForm.js', () => ({
  ContactForm: () => <div data-testid="contact-form" />,
}));

const { default: ContactPage, generateMetadata } = await import('./page.js');

describe('ContactPage', () => {
  it('renders the heading + the contact form', () => {
    render(<ContactPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Contact us' })).toBeInTheDocument();
    expect(screen.getByTestId('contact-form')).toBeInTheDocument();
  });

  it('builds canonical metadata for the contact page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/contact');
    expect(meta.title).toBe('Contact us');
  });
});
