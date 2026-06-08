'use client';

// responsive-coverage: opt-out all — Popover is a fluid/viewport-invariant primitive; responsive layout is verified where it composes into page tests.
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

/** The edge of the trigger the panel is anchored to. */
export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * The ARIA + handler props the Popover wires onto its trigger. A render-function
 * trigger receives these and must spread them onto a real interactive element so
 * the popover relationship (`aria-haspopup` / `aria-expanded` / `aria-controls`)
 * and the toggle click are present (G9).
 */
export interface PopoverTriggerProps {
  id: string;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: () => void;
  ref: (node: HTMLElement | null) => void;
}

export interface PopoverProps {
  /**
   * The trigger. Either a label (`ReactNode`) — rendered inside a first-party
   * `<button>` — or a render function that receives `PopoverTriggerProps` to
   * spread onto a custom interactive element.
   */
  trigger: ReactNode | ((props: PopoverTriggerProps) => ReactElement);
  /** The panel content. */
  children: ReactNode;
  /** The edge the panel is anchored to relative to the trigger. Defaults to `bottom`. */
  side?: PopoverSide;
  /** Controlled open state. When supplied, the parent owns visibility. */
  open?: boolean;
  /** Initial open state when uncontrolled. Ignored if `open` is supplied. */
  defaultOpen?: boolean;
  /** Called whenever the popover requests a new open state (toggle, Escape, outside-click). */
  onOpenChange?: (open: boolean) => void;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Selector matching the elements that can hold keyboard focus. */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Collect the visible, tabbable descendants of a container in DOM order. */
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Popover — the first-party EPIC-L floating panel anchored to a trigger button.
 * Unlike `Modal`/`Drawer` it is non-modal: there is no scrim and no focus trap;
 * it is a transient overlay dismissed by Escape, an outside-click, or toggling
 * the trigger.
 *
 * Accessible by construction (G9): the trigger carries
 * `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls` pointing at the
 * panel; the panel is a `role="dialog"` labelled by the trigger via
 * `aria-labelledby`. On open, focus moves into the panel; on close, focus is
 * restored to the trigger. The panel is portalled to `document.body` so it
 * escapes any `overflow`/`transform` ancestor. Token-driven via `Popover.css`.
 *
 * Works controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 */
export function Popover({
  trigger,
  children,
  side = 'bottom',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: PopoverProps): ReactElement {
  const triggerId = useId();
  const panelId = useId();
  const labelId = useId();
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** The element focused immediately before the popover opened. */
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Request a new open state: update local state when uncontrolled, and always
  // notify the parent so a controlled owner can react.
  const setOpen = useCallback(
    (next: boolean): void => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const handleToggle = useCallback((): void => {
    setOpen(!open);
  }, [open, setOpen]);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, [setOpen]);

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

  // While open: Escape closes (non-modal, so Tab is NOT trapped — focus may
  // leave the panel naturally). Bound to the document so it fires regardless of
  // which descendant holds focus.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleClose]);

  // While open: a pointer-down anywhere outside the trigger and the panel
  // dismisses the popover (the canonical light-dismiss behaviour). Using
  // `mousedown` (rather than `click`) closes before a focus shift on the outside
  // target, and matches user-event's pointer sequence.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target === null) return;
      const panel = panelRef.current;
      const triggerEl = triggerRef.current;
      if (panel?.contains(target)) return;
      if (triggerEl?.contains(target)) return;
      handleClose();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, handleClose]);

  const triggerProps: PopoverTriggerProps = {
    id: triggerId,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': panelId,
    onClick: handleToggle,
    ref: (node) => {
      triggerRef.current = node;
    },
  };

  // A render-function trigger owns its own element; a node trigger is wrapped in
  // the first-party popover button. The button's ref needs an HTMLButtonElement
  // form of the shared ref setter.
  const renderedTrigger =
    typeof trigger === 'function' ? (
      trigger(triggerProps)
    ) : (
      <button
        type="button"
        className="popover-trigger"
        {...(triggerProps as PopoverTriggerProps & ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {trigger}
      </button>
    );

  return (
    <>
      {renderedTrigger}
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-labelledby={labelId}
              tabIndex={-1}
              className={cx('popover-panel', side)}
            >
              {/* The panel's accessible name mirrors the trigger label. It is
                  visually hidden because the trigger already shows it on screen
                  — the dialog just needs a programmatic name (G9). */}
              <span id={labelId} className="popover-label">
                {typeof trigger === 'function' ? 'Popover' : trigger}
              </span>
              <div className="popover-body">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
