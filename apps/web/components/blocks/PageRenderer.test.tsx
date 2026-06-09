// responsive-coverage: opt-out all — composition test for the section→block
// mapping; responsive layout is the design-canvas / page-level e2e concern.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageRenderer } from './PageRenderer.js';
import { BLOCK_REGISTRY, SUPPORTED_BLOCK_TYPES } from './registry.js';

describe('block registry', () => {
  it('registers the V1 block set with a schema + component each', () => {
    expect(SUPPORTED_BLOCK_TYPES).toEqual(
      expect.arrayContaining(['hero', 'rich_text', 'cta_strip', 'faq']),
    );
    for (const type of SUPPORTED_BLOCK_TYPES) {
      expect(BLOCK_REGISTRY[type]?.schema).toBeDefined();
      expect(BLOCK_REGISTRY[type]?.Component).toBeTypeOf('function');
    }
  });
});

describe('PageRenderer', () => {
  it('renders registered sections in order', () => {
    render(
      <PageRenderer
        sections={[
          { type: 'hero', data: { title: 'Welcome' } },
          { type: 'cta_strip', data: { heading: 'Sell?', ctaLabel: 'Go', ctaHref: '/x' } },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Sell?' })).toBeInTheDocument();
  });

  it('skips an unknown section type (fail-soft)', () => {
    render(
      <PageRenderer
        sections={[
          { type: 'not_a_block', data: {} },
          { type: 'hero', data: { title: 'Still here' } },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Still here' })).toBeInTheDocument();
  });

  it('skips a section whose data fails its schema (fail-soft)', () => {
    render(
      <PageRenderer
        sections={[
          { type: 'hero', data: { eyebrow: 'no title' } }, // invalid: title missing
          { type: 'faq', data: { items: [{ question: 'Q?', answer: 'A.' }] } },
        ]}
      />,
    );
    expect(screen.queryByText('no title')).toBeNull();
    expect(screen.getByText('Q?')).toBeInTheDocument();
  });
});
