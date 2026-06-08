// responsive-coverage: opt-out all — AntiSpamChallenge is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests
import { useState, type ReactElement } from 'react';
import axe from 'axe-core';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AntiSpamChallenge, type TurnstileRenderer } from './AntiSpamChallenge.js';

// axe's colour-contrast rule needs real layout + canvas, which jsdom does not
// provide; it is disabled here (and verified instead in the Playwright + axe
// visual suite). Structural a11y rules (roles, names, aria) run fully in jsdom.
const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

/**
 * A fake renderer that synchronously verifies with a test token, so no real
 * Turnstile script or network is needed. Mirrors the production renderer
 * contract: it gets the container + sitekey + callbacks and returns a cleanup
 * function. The cleanup is exposed via the `cleanup` spy so unmount can be
 * asserted.
 */
function makeFakeRenderer(opts?: {
  token?: string;
  cleanup?: () => void;
  error?: string;
}): TurnstileRenderer {
  return ({ container, sitekey, onVerify, onError }) => {
    // Prove the renderer is handed the real container + sitekey it must use.
    container.setAttribute('data-rendered-sitekey', sitekey);
    if (opts?.error != null) {
      onError?.(opts.error);
    } else {
      onVerify(opts?.token ?? 'test-token');
    }
    return opts?.cleanup ?? (() => undefined);
  };
}

afterEach(() => {
  // Some tests stub window.turnstile; clear it so cases stay independent.
  delete (window as unknown as { turnstile?: unknown }).turnstile;
});

describe('AntiSpamChallenge', () => {
  it('renders an accessible, labelled challenge region', () => {
    render(
      <AntiSpamChallenge sitekey="0xSITEKEY" onVerify={vi.fn()} renderer={makeFakeRenderer()} />,
    );
    const region = screen.getByRole('group', { name: 'Security challenge' });
    expect(region).toBeInTheDocument();
  });

  it('honours a custom accessible label', () => {
    render(
      <AntiSpamChallenge
        sitekey="0xSITEKEY"
        label="Prove you are human"
        onVerify={vi.fn()}
        renderer={makeFakeRenderer()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Prove you are human' })).toBeInTheDocument();
  });

  it('passes the sitekey and a real container element to the renderer', () => {
    const renderer = vi.fn(makeFakeRenderer());
    render(<AntiSpamChallenge sitekey="0xSITEKEY" onVerify={vi.fn()} renderer={renderer} />);
    expect(renderer).toHaveBeenCalledTimes(1);
    const arg = renderer.mock.calls[0]?.[0];
    expect(arg?.sitekey).toBe('0xSITEKEY');
    expect(arg?.container).toBeInstanceOf(HTMLElement);
    // the widget mount point is inside the labelled region
    const region = screen.getByRole('group', { name: 'Security challenge' });
    expect(region).toContainElement(arg?.container as HTMLElement);
    expect(arg?.container).toHaveAttribute('data-rendered-sitekey', '0xSITEKEY');
  });

  it('surfaces the verification token through onVerify', () => {
    const onVerify = vi.fn();
    render(
      <AntiSpamChallenge
        sitekey="0xSITEKEY"
        onVerify={onVerify}
        renderer={makeFakeRenderer({ token: 'tok-abc' })}
      />,
    );
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith('tok-abc');
  });

  it('routes renderer errors to onError', () => {
    const onError = vi.fn();
    const onVerify = vi.fn();
    render(
      <AntiSpamChallenge
        sitekey="0xSITEKEY"
        onVerify={onVerify}
        onError={onError}
        renderer={makeFakeRenderer({ error: 'network' })}
      />,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('network');
    expect(onVerify).not.toHaveBeenCalled();
  });

  it('runs the renderer cleanup function on unmount', () => {
    const cleanup = vi.fn();
    const { unmount } = render(
      <AntiSpamChallenge
        sitekey="0xSITEKEY"
        onVerify={vi.fn()}
        renderer={makeFakeRenderer({ cleanup })}
      />,
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('wires the renderer exactly once across re-renders with stable props', () => {
    const renderer = vi.fn(makeFakeRenderer());

    function Harness(): ReactElement {
      const [, setTick] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            Re-render
          </button>
          <AntiSpamChallenge sitekey="0xSITEKEY" onVerify={vi.fn()} renderer={renderer} />
        </div>
      );
    }

    render(<Harness />);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it('does not throw and is a no-op when window.turnstile is absent (default renderer)', () => {
    const onVerify = vi.fn();
    // No renderer injected and no window.turnstile present: the default
    // renderer must guard for the missing global and simply do nothing.
    expect(() =>
      render(<AntiSpamChallenge sitekey="0xSITEKEY" onVerify={onVerify} />),
    ).not.toThrow();
    expect(onVerify).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Security challenge' })).toBeInTheDocument();
  });

  it('uses window.turnstile.render when present (default renderer)', () => {
    const renderId = 'widget-1';
    const render_ = vi.fn().mockReturnValue(renderId);
    const remove = vi.fn();
    (window as unknown as { turnstile?: unknown }).turnstile = {
      render: render_,
      remove,
    };

    const onVerify = vi.fn();
    const { unmount } = render(<AntiSpamChallenge sitekey="0xSITEKEY" onVerify={onVerify} />);

    expect(render_).toHaveBeenCalledTimes(1);
    const [el, params] = render_.mock.calls[0] as [
      HTMLElement,
      { sitekey: string; callback: (t: string) => void },
    ];
    expect(el).toBeInstanceOf(HTMLElement);
    expect(params.sitekey).toBe('0xSITEKEY');

    // the Turnstile success callback bridges to onVerify
    params.callback('live-token');
    expect(onVerify).toHaveBeenCalledWith('live-token');

    // cleanup removes the rendered widget by its id
    unmount();
    expect(remove).toHaveBeenCalledWith(renderId);
  });

  it('forwards a className and arbitrary attributes to the region', () => {
    render(
      <AntiSpamChallenge
        sitekey="0xSITEKEY"
        onVerify={vi.fn()}
        renderer={makeFakeRenderer()}
        className="extra"
        data-testid="challenge"
      />,
    );
    const region = screen.getByRole('group', { name: 'Security challenge' });
    expect(region).toHaveClass('anti-spam', 'extra');
    expect(region).toHaveAttribute('data-testid', 'challenge');
  });

  it('renders visible explanatory text (status conveyed beyond colour)', () => {
    render(
      <AntiSpamChallenge sitekey="0xSITEKEY" onVerify={vi.fn()} renderer={makeFakeRenderer()} />,
    );
    // a human-readable description accompanies the widget — not colour-only,
    // not placeholder-only
    expect(screen.getByText(/protected by a privacy-friendly security check/i)).toBeInTheDocument();
  });

  it('has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <AntiSpamChallenge sitekey="0xSITEKEY" onVerify={vi.fn()} renderer={makeFakeRenderer()} />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
