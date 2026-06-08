'use client';

// responsive-coverage: opt-out all — Drawer responsive sheet/panel layout is verified via Playwright in a follow-on; RTL covers focus/escape/aria behaviour
import { useCallback, useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Drawer.css';

/** The viewport edge the drawer is anchored to. */
export type DrawerSide = 'left' | 'right' | 'bottom';

/** Size presets, mapped to the canvas's panel width / sheet height surfaces. */
export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  /** Whether the drawer is open. When false, nothing is rendered. */
  open: boolean;
  /**
   * Called when the user requests dismissal — the close button, the Escape key,
   * or (unless disabled) a backdrop click. The parent owns the `open` state.
   */
  onClose: () => void;
  /**
   * The drawer title. Rendered as a heading and wired to the dialog via
   * `aria-labelledby`, giving the panel its accessible name (G9).
   */
  title: ReactNode;
  /** The drawer body content. */
  children: ReactNode;
  /** The edge the panel is anchored to. Defaults to `right`. */
  side?: DrawerSide;
  /** Size preset (panel width for left/right, sheet height for bottom). Defaults to `md`. */
  size?: DrawerSize;
  /** Whether clicking the backdrop closes the drawer. Defaults to `true`. */
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
 * Drawer — the first-party EPIC-L off-canvas panel. Built on the Modal
 * precedent but edge-anchored: a panel slides in from the left, right, or bottom
 * of the viewport over a scrim, rendered through a portal to `document.body` so
 * it escapes any `overflow`/`transform` ancestor.
 *
 * Accessible by construction (G9): `role="dialog" aria-modal="true"`, labelled
 * by its title via `aria-labelledby`; on open, focus moves into the panel and
 * is trapped (Tab/Shift+Tab wrap within); Escape closes; on close, focus is
 * restored to the element that had it before the drawer opened (the trigger).
 * Token-driven via `Drawer.css` (G7). Responsive layout (full-width/height
 * sheet on mobile, side panel on desktop) is handled in CSS media queries.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  size = 'md',
  closeOnBackdrop = true,
}: DrawerProps): ReactElement | null {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  /** The element focused immediately before the drawer opened. */
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Stable onClose for the effect's dependency list.
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // On open: remember the trigger and move focus into the panel. On close (or
  // unmount), restore focus to the trigger.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (panel) {
      const focusable = getFocusable(panel);
      // Move focus to the first focusable control, else the panel itself.
      (focusable[0] ?? panel).focus();
    }

    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Keyboard handling while open, bound to the document so it fires regardless
  // of which descendant holds focus: Escape closes, and Tab / Shift+Tab are
  // trapped so focus wraps within the panel's focusable elements (G9). Binding
  // here (rather than via an onKeyDown on the role="dialog" element) keeps the
  // non-interactive panel free of event handlers (jsx-a11y clean).
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = getFocusable(panel);
      if (focusable.length === 0) {
        // Nothing tabbable — keep focus on the panel itself.
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === panel) {
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
  // so a drag that starts inside the panel and releases over the scrim resolves
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
    <div className={cx('drawer-backdrop', side)} role="presentation">
      {closeOnBackdrop ? (
        // A redundant mouse affordance only — the panel's visible close button
        // and the Escape key are the accessible dismiss paths, so this is hidden
        // from the a11y tree and the Tab order (no duplicate "Close" control).
        <button
          type="button"
          className="drawer-scrim"
          data-testid="drawer-backdrop"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onScrimClick}
        />
      ) : (
        <div className="drawer-scrim" data-testid="drawer-backdrop" role="presentation" />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('drawer', side, size)}
      >
        <header className="drawer-header">
          <h2 id={titleId} className="drawer-title">
            {title}
          </h2>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close panel"
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

        <div className="drawer-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
