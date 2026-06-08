// responsive-coverage: opt-out all — FormSuccess is a fluid-width confirmation
// block; its responsive layout is verified where it composes into form/page
// tests, not in isolation here.
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormSuccess } from './FormSuccess.js';

const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('FormSuccess', () => {
  it('announces the confirmation through a polite live region (role="status")', () => {
    render(<FormSuccess title="Your enquiry was sent" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the title as a heading named by the region', () => {
    render(<FormSuccess title="Your viewing is requested" />);
    expect(screen.getByRole('heading', { name: 'Your viewing is requested' })).toBeInTheDocument();
  });

  it('renders the optional message text when supplied', () => {
    render(
      <FormSuccess title="Repair reported" message="The management team has been notified." />,
    );
    expect(screen.getByText('The management team has been notified.')).toBeInTheDocument();
  });

  it('does not render a message paragraph when no message is supplied', () => {
    render(<FormSuccess title="Changes saved" />);
    // only the heading text is present; querying the absent message is safe
    expect(screen.queryByText('The management team has been notified.')).not.toBeInTheDocument();
  });

  it('renders children below the message (e.g. next-step actions)', () => {
    render(
      <FormSuccess title="Your viewing is requested" message="We emailed you a copy.">
        <a href="/properties">Back to property</a>
      </FormSuccess>,
    );
    expect(screen.getByRole('link', { name: 'Back to property' })).toBeInTheDocument();
  });

  it('names the region by its heading via aria-labelledby (G9)', () => {
    render(<FormSuccess title="Property published" />);
    expect(screen.getByRole('status', { name: 'Property published' })).toBeInTheDocument();
  });

  it('merges a custom className onto the status container', () => {
    render(<FormSuccess title="Saved" className="extra" />);
    expect(screen.getByRole('status')).toHaveClass('form-success', 'extra');
  });

  it('forwards arbitrary attributes to the status container', () => {
    render(<FormSuccess title="Saved" data-testid="confirm" />);
    expect(screen.getByTestId('confirm')).toBeInTheDocument();
  });

  it('forwards a ref to the status container', () => {
    const ref = createRef<HTMLDivElement>();
    render(<FormSuccess title="Saved" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <FormSuccess title="Your enquiry was sent" message="We will reply within one working day.">
        <a href="/properties">Browse more properties</a>
      </FormSuccess>,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
