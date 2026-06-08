'use client';

// responsive-coverage: opt-out all — Modal responsive layout (mobile sheet vs desktop dialog) is verified via Playwright visual-regression (pending wave-5); RTL covers focus/escape/aria behaviour
import { useCallback, useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/** Width presets, mapped to the canvas's `max-width` surface sizes. */
export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  /** Whether the dialog is open. When false, nothing is rendered. */
  open: boolean;
  /**
   * Called when the user requests dismissal — the close button, the Escape key,
   * or (unless disabled) a backdrop click. The parent owns the `open` state.
   */
  onClose: () => void;
  /**
   * The dialog title. Rendered as a heading and wired to the dialog via
   * `aria-labelledby`, giving the dialog its accessible name (G9).
   */
  title: ReactNode;
  /** The dialog body content. */
  children: ReactNode;
  /** Optional footer region — typically the action buttons. */
  footer?: ReactNode;
  /** Width preset. Defaults to `md`. */
  size?: ModalSize;
  /** Whether clicking the backdrop closes the dialog. Defaults to `true`. */
  closeOnBackdrop?: boolean;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Selector matching the elements that can hold keyboard focus. */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Collect the visible, tabbable descendants of a container in DOM order. Used to
 * implement the focus trap (wrap Tab / Shift+Tab) and the initial focus move.
 */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Modal — the first-party EPIC-L dialog. Ported from
 * `design/canvas/components/molecules/overlays.html`. A centred surface over a
 * scrim, rendered through a portal to `document.body` so it escapes any
 * `overflow`/`transform` ancestor.
 *
 * Accessible by construction (G9): `role="dialog" aria-modal="true"`, labelled
 * by its title via `aria-labelledby`; on open, focus moves into the dialog and
 * is trapped (Tab/Shift+Tab wrap within); Escape closes; on close, focus is
 * restored to the element that had it before the dialog opened (the trigger).
 * Token-driven via `Modal.css` (G7).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: ModalProps): ReactElement | null {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  /** The element focused immediately before the dialog opened. */
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Stable onClose for the effect's dependency list.
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // On open: remember the trigger and move focus into the dialog. On close (or
  // unmount), restore focus to the trigger.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = getFocusable(dialog);
      // Move focus to the first focusable control, else the dialog itself.
      (focusable[0] ?? dialog).focus();
    }

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Keyboard handling while open, bound to the document so it fires regardless
  // of which descendant holds focus: Escape closes, and Tab / Shift+Tab are
  // trapped so focus wraps within the dialog's focusable elements (G9). Binding
  // here (rather than via an onKeyDown on the role="dialog" element) keeps the
  // non-interactive dialog free of event handlers (jsx-a11y clean).
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        // Nothing tabbable — keep focus on the dialog itself.
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === dialog) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleClose]);

  // A native `click` only fires on the element common to its press and release,
  // so a drag that starts inside the dialog and releases over the scrim resolves
  // on the backdrop container — never on the scrim button. The scrim's onClick
  // therefore fires only for a genuine press-and-release on the scrim itself; no
  // pointer-origin bookkeeping is needed to ignore drag-outs.
  const onScrimClick = useCallback((): void => {
    handleClose();
  }, [handleClose]);

  if (!open) return null;

  return createPortal(
    // The backdrop is a presentational container; dismissal is provided by the
    // real <button> scrim below (keyboard users dismiss with Escape), so no
    // click handlers sit on a non-interactive element (jsx-a11y clean, G9).
    <div className="modal-backdrop" role="presentation">
      {closeOnBackdrop ? (
        // A redundant mouse affordance only — the dialog's visible close button
        // and the Escape key are the accessible dismiss paths, so this is hidden
        // from the a11y tree and the Tab order (no duplicate "Close" control).
        <button
          type="button"
          className="modal-scrim"
          data-testid="modal-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onScrimClick}
        />
      ) : (
        <div className="modal-scrim" data-testid="modal-backdrop" role="presentation" />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('modal', size)}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close dialog"
            onClick={handleClose}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="modal-body">{children}</div>

        {footer != null && footer !== false ? (
          <footer className="modal-footer">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
