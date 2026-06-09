// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TwoColumnBlock, twoColumnBlockSchema } from './TwoColumnBlock.js';

describe('TwoColumnBlock', () => {
  it('renders both columns (title + body)', () => {
    render(
      <TwoColumnBlock
        data={{
          heading: 'Selling vs letting',
          columns: [
            { title: 'Selling', body: 'Reach buyers fast.' },
            { title: 'Letting', body: 'Vetted tenants.' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Selling')).toBeInTheDocument();
    expect(screen.getByText('Reach buyers fast.')).toBeInTheDocument();
    expect(screen.getByText('Letting')).toBeInTheDocument();
  });

  it('renders a column without a title', () => {
    render(
      <TwoColumnBlock data={{ columns: [{ body: 'Left only.' }, { body: 'Right only.' }] }} />,
    );
    expect(screen.getByText('Left only.')).toBeInTheDocument();
    expect(screen.getByText('Right only.')).toBeInTheDocument();
  });

  it('schema requires exactly two columns, each with a body', () => {
    expect(twoColumnBlockSchema.safeParse({ columns: [{ body: 'a' }] }).success).toBe(false);
    expect(
      twoColumnBlockSchema.safeParse({ columns: [{ body: 'a' }, { body: 'b' }] }).success,
    ).toBe(true);
    expect(
      twoColumnBlockSchema.safeParse({ columns: [{ body: 'a' }, { body: 'b' }, { body: 'c' }] })
        .success,
    ).toBe(false);
    expect(
      twoColumnBlockSchema.safeParse({ columns: [{ title: 'T' }, { body: 'b' }] }).success,
    ).toBe(false);
  });
});
