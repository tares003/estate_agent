// responsive-coverage: opt-out all — block composition test; responsive layout is
// the calculator components' / page-level concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CalculatorBlock } from './CalculatorBlock.js';
import { calculatorBlockSchema } from './calculator-options.js';

// EPIC-W FR-W-9 — the page-builder calculator block: lets an editor embed either
// indicative calculator on any CMS-managed page, with an optional heading.

describe('CalculatorBlock', () => {
  it('embeds the mortgage calculator when kind is "mortgage"', () => {
    render(<CalculatorBlock data={{ kind: 'mortgage' }} />);
    expect(screen.getByTestId('monthly-repayment')).toBeInTheDocument();
  });

  it('embeds the stamp-duty calculator when kind is "stamp_duty"', () => {
    render(<CalculatorBlock data={{ kind: 'stamp_duty' }} />);
    expect(screen.getByTestId('total-tax')).toBeInTheDocument();
  });

  it('renders the optional heading above the calculator', () => {
    render(<CalculatorBlock data={{ kind: 'mortgage', heading: 'Work out your repayments' }} />);
    expect(screen.getByRole('heading', { name: 'Work out your repayments' })).toBeInTheDocument();
  });

  it('schema requires a known kind and leaves heading optional', () => {
    expect(calculatorBlockSchema.safeParse({ kind: 'mortgage' }).success).toBe(true);
    expect(calculatorBlockSchema.safeParse({ kind: 'stamp_duty', heading: 'h' }).success).toBe(
      true,
    );
    expect(calculatorBlockSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
    expect(calculatorBlockSchema.safeParse({}).success).toBe(false);
  });
});
