// responsive-coverage: opt-out all — TrialCountdownPill is a fixed-height fluid-width atom; responsive layout is verified where it composes into page/organism tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialCountdownPill } from './TrialCountdownPill.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite where the real browser renders the token colours). Structural
// a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('TrialCountdownPill', () => {
  it('renders the base pill class', () => {
    render(<TrialCountdownPill daysRemaining={7} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('trial-countdown-pill');
  });

  // ---- Pluralisation: N vs 1 ------------------------------------------------
  it('renders the plural form for many days remaining', () => {
    render(<TrialCountdownPill daysRemaining={7} />);
    expect(screen.getByText('7 days left')).toBeInTheDocument();
  });

  it('renders the singular form for exactly one day remaining', () => {
    render(<TrialCountdownPill daysRemaining={1} />);
    expect(screen.getByText('1 day left')).toBeInTheDocument();
    expect(screen.queryByText('1 days left')).not.toBeInTheDocument();
  });

  it('renders the plural form for two days remaining', () => {
    render(<TrialCountdownPill daysRemaining={2} />);
    expect(screen.getByText('2 days left')).toBeInTheDocument();
  });

  // ---- Ended state ----------------------------------------------------------
  it('renders the ended state for zero days remaining', () => {
    render(<TrialCountdownPill daysRemaining={0} />);
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
  });

  it('renders the ended state for negative days remaining', () => {
    render(<TrialCountdownPill daysRemaining={-3} />);
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
  });

  it('applies the ended tone class for the ended state', () => {
    render(<TrialCountdownPill daysRemaining={0} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('ended');
  });

  // ---- Urgent threshold (<= 3) ----------------------------------------------
  it('applies the urgent tone class at the threshold (3 days)', () => {
    render(<TrialCountdownPill daysRemaining={3} data-testid="pill" />);
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('urgent');
    expect(pill).not.toHaveClass('calm');
  });

  it('applies the urgent tone class below the threshold (1 day)', () => {
    render(<TrialCountdownPill daysRemaining={1} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('urgent');
  });

  it('applies the calm tone class above the threshold (4 days)', () => {
    render(<TrialCountdownPill daysRemaining={4} data-testid="pill" />);
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('calm');
    expect(pill).not.toHaveClass('urgent');
  });

  it('applies the calm tone class well above the threshold', () => {
    render(<TrialCountdownPill daysRemaining={30} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveClass('calm');
  });

  // ---- Tone override --------------------------------------------------------
  it('honours an explicit tone override regardless of daysRemaining', () => {
    // 30 days would normally be calm; the override forces urgent.
    render(<TrialCountdownPill daysRemaining={30} tone="urgent" data-testid="pill" />);
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('urgent');
    expect(pill).not.toHaveClass('calm');
  });

  it('honours a calm override even when days are within the urgent threshold', () => {
    render(<TrialCountdownPill daysRemaining={1} tone="calm" data-testid="pill" />);
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('calm');
    expect(pill).not.toHaveClass('urgent');
  });

  it('does not derive the label from the tone override — the ended label still follows the days', () => {
    // Tone override changes the visual treatment, not the textual meaning.
    render(<TrialCountdownPill daysRemaining={0} tone="urgent" />);
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
  });

  // ---- Accessible name ------------------------------------------------------
  it('exposes an accessible name conveying the remaining time', () => {
    render(<TrialCountdownPill daysRemaining={7} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveAccessibleName('Trial: 7 days left');
  });

  it('exposes a singular accessible name for one day', () => {
    render(<TrialCountdownPill daysRemaining={1} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveAccessibleName('Trial: 1 day left');
  });

  it('exposes an accessible name conveying the ended state', () => {
    render(<TrialCountdownPill daysRemaining={0} data-testid="pill" />);
    expect(screen.getByTestId('pill')).toHaveAccessibleName('Trial ended');
  });

  it('lets a caller override the accessible name', () => {
    render(
      <TrialCountdownPill
        daysRemaining={7}
        aria-label="Sales Plus trial: 7 days left"
        data-testid="pill"
      />,
    );
    expect(screen.getByTestId('pill')).toHaveAccessibleName('Sales Plus trial: 7 days left');
  });

  // ---- Structure / forwarding ----------------------------------------------
  it('renders as a <span> by default (non-interactive status)', () => {
    render(<TrialCountdownPill daysRemaining={7} data-testid="pill" />);
    expect(screen.getByTestId('pill').tagName).toBe('SPAN');
  });

  it('forwards a ref to the underlying span element', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<TrialCountdownPill daysRemaining={7} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('forwards arbitrary attributes and merges a custom className', () => {
    render(
      <TrialCountdownPill daysRemaining={7} className="extra" data-testid="pill" title="tip" />,
    );
    const pill = screen.getByTestId('pill');
    expect(pill).toHaveClass('trial-countdown-pill', 'calm', 'extra');
    expect(pill).toHaveAttribute('title', 'tip');
  });

  // ---- Edge: non-integer input ---------------------------------------------
  it('floors a fractional day count for the visible label', () => {
    render(<TrialCountdownPill daysRemaining={2.9} />);
    expect(screen.getByText('2 days left')).toBeInTheDocument();
  });

  // ---- Accessibility --------------------------------------------------------
  it('has no detectable axe-core accessibility violations (calm)', async () => {
    const { container } = render(<TrialCountdownPill daysRemaining={7} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (urgent)', async () => {
    const { container } = render(<TrialCountdownPill daysRemaining={2} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('has no detectable axe-core accessibility violations (ended)', async () => {
    const { container } = render(<TrialCountdownPill daysRemaining={0} />);
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
