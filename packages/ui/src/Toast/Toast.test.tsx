// responsive-coverage: opt-out all — Toast is a fixed-width transient overlay atom; responsive placement is verified where it composes into the toast-region page tests
import { createRef } from 'react';
import axe from 'axe-core';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast.js';

describe('Toast', () => {
  it('renders the title and message', () => {
    render(
      <Toast tone="success" title="Viewing requested">
        We have sent your request to the Didsbury branch.
      </Toast>,
    );
    expect(screen.getByText('Viewing requested')).toBeInTheDocument();
    expect(
      screen.getByText('We have sent your request to the Didsbury branch.'),
    ).toBeInTheDocument();
  });

  it('accepts the message via the message prop as well as children', () => {
    render(<Toast tone="info" message="Saved to your shortlist" />);
    expect(screen.getByText('Saved to your shortlist')).toBeInTheDocument();
  });

  it('renders the base toast class and the tone class', () => {
    const { container } = render(<Toast tone="warning" message="Heads up" />);
    const root = container.firstElementChild;
    expect(root).toHaveClass('toast', 'warning');
  });

  it.each(['success', 'info', 'warning', 'danger'] as const)(
    'applies the %s tone class',
    (tone) => {
      const { container } = render(<Toast tone={tone} message="Label" />);
      expect(container.firstElementChild).toHaveClass(tone);
    },
  );

  // role per tone — polite for success/info, assertive for error -------------
  it('uses role="status" (polite) for the success tone', () => {
    render(<Toast tone="success" message="Done" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses role="status" (polite) for the info tone', () => {
    render(<Toast tone="info" message="Heads up" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses role="status" (polite) for the warning tone', () => {
    render(<Toast tone="warning" message="Careful" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses role="alert" (assertive) for the danger tone', () => {
    render(<Toast tone="danger" message="Could not send your enquiry" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // dismiss -------------------------------------------------------------------
  it('renders a dismiss button with an accessible label by default', () => {
    render(<Toast tone="info" message="Hello" />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('accepts a custom dismiss label', () => {
    render(<Toast tone="info" message="Hello" dismissLabel="Close notification" />);
    expect(screen.getByRole('button', { name: 'Close notification' })).toBeInTheDocument();
  });

  it('fires onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<Toast tone="info" message="Hello" onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('omits the dismiss button when dismissible is false', () => {
    render(<Toast tone="info" message="Hello" dismissible={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // auto-dismiss via injectable timers ---------------------------------------
  describe('auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onDismiss after the duration elapses', () => {
      const onDismiss = vi.fn();
      render(<Toast tone="success" message="Done" duration={5000} onDismiss={onDismiss} />);
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('is sticky (never auto-dismisses) when no duration is given', () => {
      const onDismiss = vi.fn();
      render(<Toast tone="info" message="Sticky" onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('is sticky when duration is 0', () => {
      const onDismiss = vi.fn();
      render(<Toast tone="info" message="Sticky" duration={0} onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('does not throw when a duration is set but no onDismiss handler is given', () => {
      render(<Toast tone="success" message="Done" duration={3000} />);
      expect(() => {
        act(() => {
          vi.advanceTimersByTime(3000);
        });
      }).not.toThrow();
    });

    it('clears the auto-dismiss timer on unmount (no late call)', () => {
      const onDismiss = vi.fn();
      const { unmount } = render(
        <Toast tone="success" message="Done" duration={5000} onDismiss={onDismiss} />,
      );
      unmount();
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  it('uses an injectable clock so timers can be controlled in tests', () => {
    const setTimeoutFn = vi.fn().mockReturnValue(42);
    const clearTimeoutFn = vi.fn();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <Toast
        tone="success"
        message="Done"
        duration={5000}
        onDismiss={onDismiss}
        setTimeoutFn={setTimeoutFn}
        clearTimeoutFn={clearTimeoutFn}
      />,
    );
    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 5000);
    // Run the scheduled callback by hand.
    const scheduled = setTimeoutFn.mock.calls[0]?.[0] as () => void;
    act(() => {
      scheduled();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
    expect(clearTimeoutFn).toHaveBeenCalledWith(42);
  });

  // structure / forwarding ----------------------------------------------------
  it('forwards a ref to the root element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Toast ref={ref} tone="info" message="Hi" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('forwards arbitrary attributes and merges a custom className', () => {
    const { container } = render(
      <Toast tone="info" message="Hi" className="extra" data-testid="toast" />,
    );
    const root = screen.getByTestId('toast');
    expect(root).toBe(container.firstElementChild);
    expect(root).toHaveClass('toast', 'info', 'extra');
  });

  // accessibility -------------------------------------------------------------
  const axeOptions = { rules: { 'color-contrast': { enabled: false } } } as const;

  it('a polite toast has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <Toast tone="success" title="Viewing requested">
        We have sent your request.
      </Toast>,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });

  it('an assertive toast has no detectable axe-core accessibility violations', async () => {
    const { container } = render(
      <Toast tone="danger" title="Could not send" message="Please try again." />,
    );
    const results = await axe.run(container, axeOptions);
    expect(results.violations).toEqual([]);
  });
});
