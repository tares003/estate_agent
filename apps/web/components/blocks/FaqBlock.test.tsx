// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaqBlock, faqBlockSchema } from './FaqBlock.js';

describe('FaqBlock', () => {
  it('renders each question + answer as a native disclosure', () => {
    render(
      <FaqBlock
        data={{
          title: 'Common questions',
          items: [
            { question: 'How long does a sale take?', answer: 'Typically 8–12 weeks.' },
            { question: 'Do you charge upfront?', answer: 'No upfront fees.' },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Common questions' })).toBeInTheDocument();
    expect(screen.getByText('How long does a sale take?')).toBeInTheDocument();
    expect(screen.getByText('Typically 8–12 weeks.')).toBeInTheDocument();
    expect(document.querySelectorAll('details')).toHaveLength(2);
  });

  it('schema requires at least one item', () => {
    expect(faqBlockSchema.safeParse({ items: [] }).success).toBe(false);
    expect(faqBlockSchema.safeParse({ items: [{ question: 'q', answer: 'a' }] }).success).toBe(
      true,
    );
  });
});
