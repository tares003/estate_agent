// responsive-coverage: opt-out all — block composition test; responsive layout is
// the design-canvas / page-level e2e concern (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichTextBlock, richTextBlockSchema } from './RichTextBlock.js';

describe('RichTextBlock', () => {
  it('injects the CMS-authored HTML', () => {
    render(<RichTextBlock data={{ html: '<h2>About us</h2><p>We are local.</p>' }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'About us' })).toBeInTheDocument();
    expect(screen.getByText('We are local.')).toBeInTheDocument();
  });

  it('applies centre alignment when requested', () => {
    const { container } = render(
      <RichTextBlock data={{ html: '<p>Centred</p>', align: 'center' }} />,
    );
    expect(container.querySelector('.text-center')).not.toBeNull();
  });

  it('schema requires html', () => {
    expect(richTextBlockSchema.safeParse({}).success).toBe(false);
    expect(richTextBlockSchema.safeParse({ html: '<p>x</p>' }).success).toBe(true);
  });
});
