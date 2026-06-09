// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThreePillarBlock, threePillarBlockSchema } from './ThreePillarBlock.js';

describe('ThreePillarBlock', () => {
  it('renders the heading and each pillar', () => {
    render(
      <ThreePillarBlock
        data={{
          heading: 'Why agencies switch',
          pillars: [
            { title: 'Secure', body: 'Encrypted at rest.' },
            { title: 'Fast', body: 'Sub-second search.' },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Why agencies switch' })).toBeInTheDocument();
    expect(screen.getByText('Secure')).toBeInTheDocument();
    expect(screen.getByText('Sub-second search.')).toBeInTheDocument();
  });

  it('omits the heading when absent', () => {
    render(<ThreePillarBlock data={{ pillars: [{ title: 'Solo', body: 'x' }] }} />);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('schema requires >=1 pillar each with title + body, capped at three', () => {
    expect(threePillarBlockSchema.safeParse({ pillars: [] }).success).toBe(false);
    expect(threePillarBlockSchema.safeParse({ pillars: [{ title: 'T', body: 'B' }] }).success).toBe(
      true,
    );
    expect(threePillarBlockSchema.safeParse({ pillars: [{ title: 'T' }] }).success).toBe(false);
    const four = [1, 2, 3, 4].map((n) => ({ title: `T${n}`, body: 'b' }));
    expect(threePillarBlockSchema.safeParse({ pillars: four }).success).toBe(false);
  });
});
