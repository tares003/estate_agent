// responsive-coverage: opt-out all — Avatar is a fixed-size square atom; its --space-* box is viewport-invariant and responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar.js';

describe('Avatar', () => {
  it('renders the base avatar class', () => {
    const { container } = render(<Avatar name="Albert Aardvark" />);
    expect(container.querySelector('.avatar')).toBeInTheDocument();
  });

  describe('with an image source', () => {
    it('renders an <img> using the name as alt text', () => {
      render(<Avatar name="Albert Aardvark" src="/agents/albert.jpg" />);
      const img = screen.getByRole('img');
      expect(img.tagName).toBe('IMG');
      expect(img).toHaveAttribute('src', '/agents/albert.jpg');
      expect(img).toHaveAttribute('alt', 'Albert Aardvark');
    });

    it('finds the image by its accessible name (the alt text)', () => {
      render(<Avatar name="Albert Aardvark" src="/agents/albert.jpg" />);
      expect(screen.getByAltText('Albert Aardvark')).toBeInTheDocument();
    });

    it('does not render the initials fallback while an image is present', () => {
      render(<Avatar name="Albert Aardvark" src="/agents/albert.jpg" />);
      expect(screen.queryByText('AA')).not.toBeInTheDocument();
    });

    it('falls back to initials when the image fails to load', () => {
      render(<Avatar name="Albert Aardvark" src="/missing.jpg" />);
      const img = screen.getByRole('img');
      expect(img.tagName).toBe('IMG');
      fireEvent.error(img);
      // The <img> tag is gone; the initials chip (also role="img") replaces it.
      expect(screen.queryByText('Albert Aardvark')).not.toBeInTheDocument();
      expect(screen.getByText('AA')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Albert Aardvark' }).tagName).toBe('SPAN');
    });
  });

  describe('initials fallback (no src)', () => {
    it('renders no <img> tag — the fallback chip is an img-role span', () => {
      render(<Avatar name="Albert Aardvark" />);
      const fallback = screen.getByRole('img', { name: 'Albert Aardvark' });
      expect(fallback.tagName).toBe('SPAN');
    });

    it('exposes the full name as the accessible name', () => {
      render(<Avatar name="Albert Aardvark" />);
      const el = screen.getByLabelText('Albert Aardvark');
      expect(el).toHaveAttribute('aria-label', 'Albert Aardvark');
      // The full name, not the initials, is what assistive tech announces.
      expect(el).toHaveAccessibleName('Albert Aardvark');
    });

    it('marks the visible initials decorative so the name is not doubled', () => {
      const { container } = render(<Avatar name="Albert Aardvark" />);
      const initials = container.querySelector('.initials');
      expect(initials).toHaveTextContent('AA');
      // The chip carries the name via aria-label; the glyphs are hidden so the
      // accessible name is the full name, never the bare "AA".
      expect(initials).toHaveAttribute('aria-label', 'Albert Aardvark');
      expect(initials?.querySelector('[aria-hidden="true"]')).toHaveTextContent('AA');
    });

    it('derives two initials from a two-word name', () => {
      render(<Avatar name="Priya Shah" />);
      expect(screen.getByText('PS')).toBeInTheDocument();
    });

    it('derives a single initial from a one-word name', () => {
      render(<Avatar name="Beyonce" />);
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('uses only the first two words for a three-word name', () => {
      render(<Avatar name="Mariam Ada Okafor" />);
      expect(screen.getByText('MA')).toBeInTheDocument();
    });

    it('uppercases lowercase initials', () => {
      render(<Avatar name="albert aardvark" />);
      expect(screen.getByText('AA')).toBeInTheDocument();
    });

    it('ignores surrounding and repeated whitespace when deriving initials', () => {
      render(<Avatar name="  Tom   Beckett  " />);
      expect(screen.getByText('TB')).toBeInTheDocument();
    });
  });

  describe('size', () => {
    it('defaults to the md size class', () => {
      const { container } = render(<Avatar name="Albert Aardvark" />);
      expect(container.querySelector('.avatar')).toHaveClass('md');
    });

    it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
      const { container } = render(<Avatar name="Albert Aardvark" size={size} />);
      expect(container.querySelector('.avatar')).toHaveClass(size);
    });
  });

  describe('shape', () => {
    it('defaults to the circle shape class', () => {
      const { container } = render(<Avatar name="Albert Aardvark" />);
      expect(container.querySelector('.avatar')).toHaveClass('circle');
    });

    it.each(['circle', 'square'] as const)('applies the %s shape class', (shape) => {
      const { container } = render(<Avatar name="Albert Aardvark" shape={shape} />);
      expect(container.querySelector('.avatar')).toHaveClass(shape);
    });
  });

  it('forwards a ref to the underlying span element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Avatar ref={ref} name="Albert Aardvark" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('forwards arbitrary attributes and merges a custom className', () => {
    render(<Avatar name="Albert Aardvark" className="extra" data-testid="avatar" title="tip" />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toHaveClass('avatar', 'md', 'circle', 'extra');
    expect(avatar).toHaveAttribute('title', 'tip');
  });

  // axe's colour-contrast rule needs real layout + canvas, which jsdom does not
  // provide; it is disabled here (and verified instead in the Playwright + axe
  // visual suite where the real browser renders the token colours). Structural
  // a11y rules (roles, names, alt text) run fully in jsdom.
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('has no detectable axe-core violations (image variant)', async () => {
    const { container } = render(<Avatar name="Albert Aardvark" src="/agents/albert.jpg" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core violations (initials variant)', async () => {
    const { container } = render(<Avatar name="Priya Shah" />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
