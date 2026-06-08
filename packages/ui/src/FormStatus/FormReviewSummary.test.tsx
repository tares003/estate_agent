// responsive-coverage: opt-out all — FormReviewSummary is a fluid-width
// definition list; its responsive layout is verified where it composes into the
// multi-step form/page tests, not in isolation here.
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormReviewSummary } from './FormReviewSummary.js';

const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

/** Deterministic fixture — a booked-viewing review step. */
const items = [
  { label: 'Property', value: 'Palatine Road, M20' },
  { label: 'Requested', value: 'Sat 13 Jun, 10:00 am' },
  { label: 'Reference', value: 'VW-2026-0418' },
] as const;

describe('FormReviewSummary', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<FormReviewSummary items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a definition list with a term and detail per item', () => {
    render(<FormReviewSummary items={[...items]} />);
    const terms = screen.getAllByRole('term');
    const details = screen.getAllByRole('definition');
    expect(terms).toHaveLength(3);
    expect(details).toHaveLength(3);
  });

  it('renders each label and value', () => {
    render(<FormReviewSummary items={[...items]} />);
    expect(screen.getByText('Property')).toBeInTheDocument();
    expect(screen.getByText('Palatine Road, M20')).toBeInTheDocument();
    expect(screen.getByText('Reference')).toBeInTheDocument();
    expect(screen.getByText('VW-2026-0418')).toBeInTheDocument();
  });

  it('renders no edit controls by default', () => {
    render(<FormReviewSummary items={[...items]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a single overall edit control when a single onEdit is supplied', () => {
    const onEdit = vi.fn();
    render(<FormReviewSummary items={[...items]} onEdit={onEdit} />);
    const buttons = screen.getAllByRole('button', { name: /edit/i });
    expect(buttons).toHaveLength(1);
  });

  it('fires the single onEdit when the overall edit control is activated', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<FormReviewSummary items={[...items]} onEdit={onEdit} />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders a per-item edit control accessibly named by the item label', () => {
    const onEdit = vi.fn();
    const withEdit = items.map((it) => ({ ...it, onEdit }));
    render(<FormReviewSummary items={withEdit} />);
    expect(screen.getByRole('button', { name: 'Edit Property' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Requested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Reference' })).toBeInTheDocument();
  });

  it('fires the per-item onEdit for the item whose control is activated', async () => {
    const onEditProperty = vi.fn();
    const onEditReference = vi.fn();
    const user = userEvent.setup();
    render(
      <FormReviewSummary
        items={[
          { label: 'Property', value: 'Palatine Road, M20', onEdit: onEditProperty },
          { label: 'Reference', value: 'VW-2026-0418', onEdit: onEditReference },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Property' }));
    expect(onEditProperty).toHaveBeenCalledTimes(1);
    expect(onEditReference).not.toHaveBeenCalled();
  });

  it('prefers per-item onEdit over a single overall onEdit when both are present', () => {
    const single = vi.fn();
    const perItem = vi.fn();
    render(
      <FormReviewSummary
        onEdit={single}
        items={[{ label: 'Property', value: 'Palatine Road, M20', onEdit: perItem }]}
      />,
    );
    // a per-item control is named by its label, not the generic overall control
    expect(screen.getByRole('button', { name: 'Edit Property' })).toBeInTheDocument();
  });

  it('renders ReactNode values, not just strings', () => {
    render(
      <FormReviewSummary
        items={[{ label: 'Status', value: <strong data-testid="badge">Urgent</strong> }]}
      />,
    );
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('merges a custom className onto the list container', () => {
    render(<FormReviewSummary items={[...items]} className="extra" />);
    // a <dl> has no implicit list role; locate it as the term's nearest ancestor
    const list = screen.getAllByRole('term')[0]?.closest('dl');
    expect(list).toHaveClass('form-review', 'extra');
  });

  it('forwards a ref to the definition list element', () => {
    const ref = createRef<HTMLDListElement>();
    render(<FormReviewSummary items={[...items]} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDListElement);
  });

  it('has no detectable axe-core accessibility violations (read-only)', async () => {
    const { container } = render(<FormReviewSummary items={[...items]} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (per-item edit)', async () => {
    const onEdit = vi.fn();
    const { container } = render(
      <FormReviewSummary items={items.map((it) => ({ ...it, onEdit }))} />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
