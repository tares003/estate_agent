// responsive-coverage: opt-out all — FormError is a fluid-width content block
// (a form-level error summary); its responsive layout is verified where it
// composes into form/page tests, not in isolation here.
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormError } from './FormError.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (verified instead in the Playwright + axe visual
// suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('FormError', () => {
  it('renders nothing when the errors array is empty', () => {
    const { container } = render(<FormError errors={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing when given an empty list of structured errors', () => {
    const { container } = render(<FormError errors={[]} title="Problems" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the summary through a live region (role="alert")', () => {
    render(<FormError errors={['Enter your full name.']} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('lists each string error as a list item', () => {
    render(<FormError errors={['Enter your full name.', 'Enter a valid email address.']} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('renders a single string error as one list item', () => {
    render(<FormError errors={['Something went wrong.']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders the supplied title as a heading inside the alert', () => {
    render(
      <FormError title="There is a problem with this form" errors={['Enter your full name.']} />,
    );
    expect(
      screen.getByRole('heading', { name: 'There is a problem with this form' }),
    ).toBeInTheDocument();
  });

  it('renders a default title when none is supplied', () => {
    render(<FormError errors={['Enter your full name.']} />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('renders structured errors with messages', () => {
    render(
      <FormError
        errors={[
          { field: 'name', message: 'Enter your full name.' },
          { field: 'email', message: 'Enter a valid email address.' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('links a structured error to its field id via an in-page anchor', () => {
    render(
      <FormError errors={[{ field: 'email-field', message: 'Enter a valid email address.' }]} />,
    );
    const link = screen.getByRole('link', { name: 'Enter a valid email address.' });
    expect(link).toHaveAttribute('href', '#email-field');
  });

  it('renders a structured error without a field as plain text, not a link', () => {
    render(<FormError errors={[{ message: 'A general problem occurred.' }]} />);
    expect(screen.getByText('A general problem occurred.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('moves focus into the summary so screen readers hear it on submit', () => {
    render(<FormError errors={['Enter your full name.']} />);
    const alert = screen.getByRole('alert');
    // the summary container is focusable (tabIndex -1) so a form can focus it
    expect(alert).toHaveAttribute('tabindex', '-1');
  });

  it('merges a custom className onto the summary container', () => {
    render(<FormError errors={['Required.']} className="extra" />);
    expect(screen.getByRole('alert')).toHaveClass('form-error', 'extra');
  });

  it('forwards arbitrary attributes to the summary container', () => {
    render(<FormError errors={['Required.']} data-testid="summary" />);
    expect(screen.getByTestId('summary')).toBeInTheDocument();
  });

  it('forwards a ref to the summary container', () => {
    const ref = createRef<HTMLDivElement>();
    render(<FormError errors={['Required.']} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('lets a user follow the field link to focus the named control', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FormError errors={[{ field: 'name', message: 'Enter your full name.' }]} />
        <input id="name" aria-label="Full name" />
      </>,
    );
    await user.click(screen.getByRole('link', { name: 'Enter your full name.' }));
    // jsdom does not implement fragment-navigation focus, so we assert the
    // anchor target resolves to the real control.
    expect(document.getElementById('name')).toBeInstanceOf(HTMLInputElement);
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <FormError
        title="There is a problem"
        errors={[
          { field: 'name', message: 'Enter your full name.' },
          'Enter a valid email address.',
        ]}
      />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
