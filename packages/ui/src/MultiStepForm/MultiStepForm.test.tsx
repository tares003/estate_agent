// responsive-coverage: opt-out all — MultiStepForm is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests.
import axe from 'axe-core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MultiStepForm, type MultiStepFormStep } from './MultiStepForm.js';

const steps: MultiStepFormStep[] = [
  {
    id: 'details',
    title: 'Your details',
    content: <p data-testid="panel-details">Step one content</p>,
  },
  {
    id: 'property',
    title: 'The property',
    content: <p data-testid="panel-property">Step two content</p>,
  },
  {
    id: 'review',
    title: 'Review and submit',
    content: <p data-testid="panel-review">Step three content</p>,
  },
];

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here and verified instead in the Playwright + axe
// visual suite. Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('MultiStepForm', () => {
  it('renders an ordered list step indicator with one item per step', () => {
    render(<MultiStepForm steps={steps} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('marks the active step with aria-current="step" and labels its status', () => {
    render(<MultiStepForm steps={steps} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).not.toHaveAttribute('aria-current');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('conveys step state with text, not colour alone', () => {
    render(<MultiStepForm steps={steps} />);
    const items = screen.getAllByRole('listitem');
    // visually-hidden status words present for screen-reader users
    expect(within(items[0]!).getByText(/current step/i)).toBeInTheDocument();
    expect(within(items[1]!).getByText(/not completed/i)).toBeInTheDocument();
    expect(within(items[2]!).getByText(/not completed/i)).toBeInTheDocument();
  });

  it('shows only the active step content', () => {
    render(<MultiStepForm steps={steps} />);
    expect(screen.getByTestId('panel-details')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-property')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-review')).not.toBeInTheDocument();
  });

  it('Next advances to the following step', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByTestId('panel-property')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-details')).not.toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    // the first step now reads as completed
    expect(within(items[0]!).getByText(/completed/i)).toBeInTheDocument();
  });

  it('Back returns to the previous step', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByTestId('panel-details')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
  });

  it('disables Back on the first step', () => {
    render(<MultiStepForm steps={steps} />);
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('enables Back after advancing', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('button', { name: /back/i })).toBeEnabled();
  });

  it('fires onComplete when Next is pressed on the final step', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} onComplete={onComplete} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    // now on the final step
    expect(screen.getByTestId('panel-review')).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /finish|submit|complete/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not advance past the final step (stays on the last panel)', async () => {
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /finish|submit|complete/i }));
    expect(screen.getByTestId('panel-review')).toBeInTheDocument();
  });

  it('starts at defaultStepId when provided (uncontrolled)', () => {
    render(<MultiStepForm steps={steps} defaultStepId="property" />);
    expect(screen.getByTestId('panel-property')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
  });

  it('falls back to the first step when defaultStepId does not match', () => {
    render(<MultiStepForm steps={steps} defaultStepId="nope" />);
    expect(screen.getByTestId('panel-details')).toBeInTheDocument();
  });

  it('honours a controlled currentStepId and reports changes via onStepChange', async () => {
    const onStepChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <MultiStepForm steps={steps} currentStepId="details" onStepChange={onStepChange} />,
    );
    expect(screen.getByTestId('panel-details')).toBeInTheDocument();

    // controlled: pressing Next reports the requested id but does NOT move on its own
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onStepChange).toHaveBeenCalledWith('property');
    expect(screen.getByTestId('panel-details')).toBeInTheDocument();

    // parent moves the controlled value
    rerender(<MultiStepForm steps={steps} currentStepId="property" onStepChange={onStepChange} />);
    expect(screen.getByTestId('panel-property')).toBeInTheDocument();
  });

  it('reports onStepChange when navigating uncontrolled', async () => {
    const onStepChange = vi.fn();
    const user = userEvent.setup();
    render(<MultiStepForm steps={steps} onStepChange={onStepChange} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onStepChange).toHaveBeenCalledWith('property');
  });

  it('names the active content region by its step title', () => {
    render(<MultiStepForm steps={steps} />);
    const region = screen.getByRole('group', { name: /your details/i });
    expect(within(region).getByTestId('panel-details')).toBeInTheDocument();
  });

  it('merges a custom className onto the root', () => {
    const { container } = render(<MultiStepForm steps={steps} className="extra" />);
    expect(container.firstElementChild).toHaveClass('multi-step-form', 'extra');
  });

  it('has no detectable axe-core accessibility violations on the first step', async () => {
    const { container } = render(<MultiStepForm steps={steps} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations on the final step', async () => {
    const user = userEvent.setup();
    const { container } = render(<MultiStepForm steps={steps} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
