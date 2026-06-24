// responsive-coverage: opt-out all — PrintButton is a fixed-size atom that wraps
// the EPIC-L Button; it is print:hidden and triggers window.print(); responsive
// layout is the page-level Playwright pass (design-requirements §3).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PrintButton } from './PrintButton.js';

// EPIC-W FR-W-12 — print / save-as-PDF the calculator result. A tiny client atom
// that calls window.print() on click and is hidden from the printed page itself.

describe('PrintButton', () => {
  it('renders the "Print / save as PDF" button', () => {
    render(<PrintButton />);
    expect(
      screen.getByRole('button', { name: /print \/ save as pdf/i }),
    ).toBeInTheDocument();
  });

  it('calls window.print() when clicked', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<PrintButton />);
    await user.click(screen.getByRole('button', { name: /print \/ save as pdf/i }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('is hidden from the printed page (print:hidden)', () => {
    render(<PrintButton />);
    expect(screen.getByRole('button', { name: /print \/ save as pdf/i })).toHaveClass(
      'print:hidden',
    );
  });
});
