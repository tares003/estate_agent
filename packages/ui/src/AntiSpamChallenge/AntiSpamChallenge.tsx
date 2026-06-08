'use client';

import {
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import './AntiSpamChallenge.css';

/**
 * Options handed to a renderer. The renderer owns the actual widget lifecycle:
 * it mounts a challenge into `container`, calls `onVerify` with the solved
 * token, and returns a cleanup function the component runs on unmount.
 */
export interface TurnstileRenderOptions {
  /** The element the widget must mount into (owned by this component). */
  container: HTMLElement;
  /** The public Turnstile sitekey for this tenant/deployment. */
  sitekey: string;
  /** Called with the verification token once the challenge is solved. */
  onVerify: (token: string) => void;
  /** Called when the challenge fails to load or errors. */
  onError?: ((error: string) => void) | undefined;
  /** Called when a solved token expires and a re-challenge is required. */
  onExpire?: (() => void) | undefined;
}

/**
 * A widget renderer. Receives the mount options and returns a cleanup function
 * (run on unmount). Injectable so tests can supply a fake that resolves
 * synchronously without the real Turnstile script or any network.
 */
export type TurnstileRenderer = (opts: TurnstileRenderOptions) => () => void;

export interface AntiSpamChallengeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** The public Cloudflare Turnstile sitekey. */
  sitekey: string;
  /**
   * Accessible name for the challenge region. Defaults to
   * `"Security challenge"`. Rendered as the region's `aria-label` so the widget
   * is never label-less (G9).
   */
  label?: string;
  /** Called with the verification token once the challenge is solved. */
  onVerify: (token: string) => void;
  /** Called when the challenge fails to load or errors. */
  onError?: (error: string) => void;
  /** Called when a solved token expires and a fresh challenge is required. */
  onExpire?: () => void;
  /**
   * Visible explanatory text shown beneath the widget. Keeps the challenge's
   * purpose legible (status conveyed beyond colour, not placeholder-only).
   * Defaults to a privacy-friendly description.
   */
  description?: ReactNode;
  /**
   * Widget renderer. Defaults to {@link defaultTurnstileRenderer}, which uses
   * `window.turnstile` when the script has loaded (a no-op until then). Tests
   * inject a fake renderer.
   */
  renderer?: TurnstileRenderer;
}

/** The slice of the Turnstile global this component relies on. */
interface TurnstileApi {
  render: (
    el: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: (error?: string) => void;
      'expired-callback'?: () => void;
    },
  ) => string | undefined;
  remove?: (widgetId: string) => void;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Default renderer — mounts the real Cloudflare Turnstile widget via
 * `window.turnstile.render`. Guarded: if the script has not loaded yet the
 * global is absent and this is a harmless no-op (the caller can re-mount once
 * the script is present). Bridges Turnstile's callbacks to the component's
 * `onVerify` / `onError` / `onExpire`, and removes the widget on cleanup.
 */
export const defaultTurnstileRenderer: TurnstileRenderer = ({
  container,
  sitekey,
  onVerify,
  onError,
  onExpire,
}) => {
  const turnstile = (globalThis as { turnstile?: TurnstileApi }).turnstile;
  if (turnstile == null) {
    // Script not yet loaded — nothing to render. No-op cleanup.
    return () => undefined;
  }

  const widgetId = turnstile.render(container, {
    sitekey,
    callback: onVerify,
    'error-callback': (error) => onError?.(error ?? 'turnstile-error'),
    'expired-callback': () => onExpire?.(),
  });

  return () => {
    if (widgetId != null) {
      turnstile.remove?.(widgetId);
    }
  };
};

/**
 * AntiSpamChallenge — a Cloudflare Turnstile wrapper. Turnstile is the declared
 * anti-spam sub-processor (privacy-friendly, no cookie-consent banner). The
 * widget renderer is injectable so the component stays dependency-free and
 * testable: tests supply a fake that resolves synchronously, while production
 * uses {@link defaultTurnstileRenderer} which drives `window.turnstile`.
 *
 * Accessible by construction (G9): a labelled `role="group"` region names the
 * challenge (`aria-label`, never placeholder-only), and a visible description
 * states its purpose in text (status conveyed beyond colour). Token-driven via
 * `AntiSpamChallenge.css` (G7).
 */
export function AntiSpamChallenge({
  sitekey,
  label = 'Security challenge',
  onVerify,
  onError,
  onExpire,
  description = 'Protected by a privacy-friendly security check. No personal data is stored.',
  renderer = defaultTurnstileRenderer,
  className,
  ...rest
}: AntiSpamChallengeProps): ReactElement {
  const widgetRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  // Latest callbacks/sitekey, so the widget effect can re-wire only when the
  // renderer changes — not on every parent re-render that hands new inline
  // callback identities (which would tear down and rebuild the live widget).
  const latest = useRef({ sitekey, onVerify, onError, onExpire });
  latest.current = { sitekey, onVerify, onError, onExpire };

  useEffect(() => {
    const container = widgetRef.current;
    if (container == null) return;

    const cleanup = renderer({
      container,
      sitekey: latest.current.sitekey,
      onVerify: (token) => latest.current.onVerify(token),
      onError: (error) => latest.current.onError?.(error),
      onExpire: () => latest.current.onExpire?.(),
    });

    return cleanup;
  }, [renderer]);

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={descriptionId}
      className={cx('anti-spam', className)}
      {...rest}
    >
      <div ref={widgetRef} className="anti-spam__widget" />
      <p id={descriptionId} className="anti-spam__description">
        {description}
      </p>
    </div>
  );
}
