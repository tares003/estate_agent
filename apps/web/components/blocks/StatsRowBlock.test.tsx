// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatsRowBlock, statsRowBlockSchema } from './StatsRowBlock.js';

describe('StatsRowBlock', () => {
  it('renders each stat value + label', () => {
    render(
      <StatsRowBlock
        data={{
          heading: 'By the numbers',
          stats: [
            { value: '12,000', label: 'properties listed' },
            { value: '98%', label: 'tenant satisfaction' },
          ],
        }}
      />,
    );
    expect(screen.getByText('12,000')).toBeInTheDocument();
    expect(screen.getByText('tenant satisfaction')).toBeInTheDocument();
  });

  it('schema requires >=1 stat with value + label', () => {
    expect(statsRowBlockSchema.safeParse({ stats: [] }).success).toBe(false);
    expect(statsRowBlockSchema.safeParse({ stats: [{ value: '1', label: 'x' }] }).success).toBe(
      true,
    );
    expect(statsRowBlockSchema.safeParse({ stats: [{ value: '1' }] }).success).toBe(false);
  });
});
