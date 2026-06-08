import {
  forwardRef,
  useEffect,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Toast.css';

/**
 * Toast tone. Each maps to a semantic colour token (`--colour-{success,info,
 * warning,danger}`) used for the accent bar and icon, ported one-for-one from
 * the EPIC-L feedback canvas (design/canvas/components/molecules/feedback.html).
 *
 * The tone also selects the ARIA live-region politeness: `success`/`info`/
 * `warning` announce politely (`role="status"`), while `danger` — an error the
 * user must notice — announces assertively (`role="alert"`).
 */
export type ToastTone = 'success' | 'info' | 'warning' | 'danger';

/**
 * A minimal subset of `setTimeout`/`clearTimeout` so the auto-dismiss clock can
 * be injected (and therefore controlled) in tests, rather than reaching for the
 * real globals.
 */
type SetTimeoutFn = (handler: () => void, timeout: number) => unknown;
type ClearTimeoutFn = (handle: unknown) => void;

export interface ToastProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'children' | 'title'
> {
  /** Semantic tone. Drives the accent colour, icon, and live-region politeness. */
  tone: ToastTone;
  /** Optional bold heading shown above the message. */
  title?: ReactNode;
  /** Body text. May be supplied as {@link ToastProps.message} or as children. */
  children?: ReactNode;
  /** Body text. Alias for {@link ToastProps.children}; children win if both are set. */
  message?: ReactNode;
  /** Called when the user dismisses the toast, or when {@link ToastProps.duration} elapses. */
  onDismiss?: () => void;
  /**
   * Auto-dismiss delay in milliseconds. `0` or `undefined` means the toast is
   * sticky and never auto-dismisses (it must be dismissed manually).
   */
  duration?: number;
  /** Whether to render the dismiss button. Defaults to `true`. */
  dismissible?: boolean;
  /** Accessible label for the dismiss button. Defaults to `"Dismiss"`. */
  dismissLabel?: string;
  /** Injectable `setTimeout` for the auto-dismiss clock. Defaults to the global. */
  setTimeoutFn?: SetTimeoutFn;
  /** Injectable `clearTimeout` paired with {@link ToastProps.setTimeoutFn}. */
  clearTimeoutFn?: ClearTimeoutFn;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Tones that demand an assertive announcement. */
const ASSERTIVE_TONES: ReadonlySet<ToastTone> = new Set<ToastTone>(['danger']);

/**
 * The per-tone icon, ported from the EPIC-L feedback canvas. Decorative — the
 * meaning is carried by the title/message text and the live-region role, never
 * by the glyph or colour alone (G9).
 */
function ToneIcon({ tone }: { tone: ToastTone }): ReactElement {
  const common = {
    className: 'ico',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true,
  } as const;

  if (tone === 'success') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tone === 'danger' || tone === 'warning') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16h.01" />
      </svg>
    );
  }
  // info
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

/**
 * Toast — the EPIC-L transient-notification molecule. A token-driven overlay
 * (G7) that announces itself to assistive tech via an ARIA live region: polite
 * (`role="status"`) for success/info/warning, assertive (`role="alert"`) for
 * the danger/error tone.
 *
 * Behaviour:
 * - **Auto-dismiss** is opt-in via {@link ToastProps.duration} (ms). The timer
 *   uses an *injectable* clock ({@link ToastProps.setTimeoutFn} /
 *   {@link ToastProps.clearTimeoutFn}) so tests drive it with fake timers and
 *   no real delay. `0`/`undefined` keeps the toast sticky.
 * - **Manual dismiss** via a labelled button (G9; the close control fills a
 *   `--size-touch-target-min` box). Hidden when `dismissible={false}`.
 * - The in-animation and accent treatment come from `Toast.css`; it respects
 *   `prefers-reduced-motion`.
 */
export const Toast = forwardRef(function Toast(
  {
    tone,
    title,
    children,
    message,
    onDismiss,
    duration,
    dismissible = true,
    dismissLabel = 'Dismiss',
    setTimeoutFn = (handler, timeout) => setTimeout(handler, timeout),
    clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    className,
    ...rest
  }: ToastProps,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const role = ASSERTIVE_TONES.has(tone) ? 'alert' : 'status';
  const body = children ?? message;

  useEffect(() => {
    // Sticky unless a positive duration is given.
    if (duration == null || duration <= 0) return;
    const handle = setTimeoutFn(() => {
      onDismiss?.();
    }, duration);
    return () => {
      clearTimeoutFn(handle);
    };
    // The injected clock fns are treated as stable for the toast's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, onDismiss]);

  return (
    <div ref={ref} role={role} className={cx('toast', tone, className)} {...rest}>
      <span className="bar" aria-hidden="true" />
      <ToneIcon tone={tone} />
      <div className="content">
        {title != null ? <strong className="title">{title}</strong> : null}
        {body != null ? <p className="message">{body}</p> : null}
      </div>
      {dismissible ? (
        <button type="button" className="close" aria-label={dismissLabel} onClick={onDismiss}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
