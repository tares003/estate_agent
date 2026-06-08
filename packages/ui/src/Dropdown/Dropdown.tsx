'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import './Dropdown.css';

/** One entry in the dropdown menu. */
export interface DropdownItem {
  /** Stable identifier, unique within the set; used as the React key and focus key. */
  id: string;
  /** Visible label (also the item's accessible name). */
  label: ReactNode;
  /** Called when the item is activated (click / Enter / Space). Ignored for disabled items. */
  onSelect?: () => void;
  /**
   * When set, the item renders as an `<a role="menuitem">` to this destination.
   * Activation navigates; `onSelect` (if also given) fires first.
   */
  href?: string;
  /** Disable this item: it is skipped by roving focus and never activates. */
  disabled?: boolean;
}

/** Horizontal alignment of the menu relative to the trigger. */
export type DropdownAlign = 'start' | 'end';

export interface DropdownProps {
  /** The trigger button's label (also its accessible name). */
  trigger: ReactNode;
  /** The menu entries, in order. */
  items: DropdownItem[];
  /** Which edge of the trigger the menu aligns to. Defaults to `start`. */
  align?: DropdownAlign;
  /** Extra class names merged onto the root wrapper. */
  className?: string;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** The index of the first enabled item, or -1 if none are enabled. */
function firstEnabledIndex(items: DropdownItem[]): number {
  return items.findIndex((item) => !item.disabled);
}

/** The index of the last enabled item, or -1 if none are enabled. */
function lastEnabledIndex(items: DropdownItem[]): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Step from `from` in `direction` (+1/-1), skipping disabled items and wrapping
 * around the ends. Returns the original index when no enabled item exists.
 */
function stepEnabled(items: DropdownItem[], from: number, direction: 1 | -1): number {
  const count = items.length;
  if (count === 0) return from;
  let next = from;
  for (let i = 0; i < count; i += 1) {
    next = (next + direction + count) % count;
    if (!items[next]?.disabled) return next;
  }
  return from;
}

/**
 * Dropdown — the first-party EPIC-L menu button. A real `<button>` trigger
 * carrying `aria-haspopup="menu"` + `aria-expanded` opens a `role="menu"` of
 * `role="menuitem"` entries (buttons, or anchors when an item has an `href`).
 *
 * Accessible by construction (G9), following the WAI-ARIA menu-button pattern:
 * the menu is wired back to the trigger via `aria-labelledby`; a roving tabindex
 * keeps exactly one item in the Tab order; ArrowDown/ArrowUp move (and wrap)
 * between enabled items, Home/End jump to the first/last, disabled items are
 * skipped; Enter/Space (or a click) activate; Escape and an outside click close,
 * and on close focus returns to the trigger. Token-driven via `Dropdown.css`
 * (G7); the trigger and items meet the 44px touch-target minimum.
 */
export function Dropdown({
  trigger,
  items,
  align = 'start',
  className,
}: DropdownProps): ReactElement {
  const menuId = useId();
  const triggerId = useId();

  const [open, setOpen] = useState(false);
  /** Index of the roving-focused item while open; -1 when none/closed. */
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Refs to each item element, keyed by item id, for moving DOM focus. */
  const itemRefs = useRef(new Map<string, HTMLElement>());
  /**
   * When set, the next render's effect should move focus to this item index
   * (used so focus follows selection only when we deliberately open/navigate,
   * not on every state change).
   */
  const pendingFocus = useRef<number | null>(null);

  const close = useCallback((returnFocus: boolean): void => {
    setOpen(false);
    setActiveIndex(-1);
    pendingFocus.current = null;
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openAt = useCallback((index: number): void => {
    setOpen(true);
    setActiveIndex(index);
    pendingFocus.current = index;
  }, []);

  // Move DOM focus to the pending item after the menu has rendered.
  useEffect(() => {
    if (!open) return;
    const index = pendingFocus.current;
    if (index === null) return;
    const item = items[index];
    if (item) itemRefs.current.get(item.id)?.focus();
    pendingFocus.current = null;
  });

  // While open, an outside pointer-down or focus-out closes the menu (no focus
  // return — the user has moved elsewhere). Bound to the document so it fires
  // regardless of where the interaction lands.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        close(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const activate = useCallback(
    (item: DropdownItem): void => {
      if (item.disabled) return;
      item.onSelect?.();
      // Anchors navigate via their own default behaviour; we still close.
      close(true);
    },
    [close],
  );

  const onTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>): void => {
      switch (event.key) {
        case 'ArrowDown':
        case 'Enter':
        case ' ':
          event.preventDefault();
          openAt(firstEnabledIndex(items));
          break;
        case 'ArrowUp':
          event.preventDefault();
          openAt(lastEnabledIndex(items));
          break;
        default:
      }
    },
    [items, openAt],
  );

  const focusIndex = useCallback(
    (index: number): void => {
      setActiveIndex(index);
      const item = items[index];
      if (item) itemRefs.current.get(item.id)?.focus();
    },
    [items],
  );

  const onItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusIndex(stepEnabled(items, activeIndex, 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusIndex(stepEnabled(items, activeIndex, -1));
          break;
        case 'Home':
          event.preventDefault();
          focusIndex(firstEnabledIndex(items));
          break;
        case 'End':
          event.preventDefault();
          focusIndex(lastEnabledIndex(items));
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          close(true);
          break;
        case 'Tab':
          // Tabbing away dismisses the menu; let focus move naturally.
          close(false);
          break;
        default:
      }
    },
    [items, activeIndex, focusIndex, close],
  );

  const setItemRef = useCallback(
    (id: string) =>
      (node: HTMLElement | null): void => {
        if (node) itemRefs.current.set(id, node);
        else itemRefs.current.delete(id);
      },
    [],
  );

  return (
    <div ref={rootRef} className={cx('dropdown', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        className="dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) close(false);
          else openAt(firstEnabledIndex(items));
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          className={cx('dropdown-menu', `align-${align}`)}
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            const tabIndex = isActive ? 0 : -1;
            const itemClassName = cx('dropdown-item', item.disabled && 'is-disabled');

            if (item.href !== undefined && !item.disabled) {
              return (
                <a
                  key={item.id}
                  ref={setItemRef(item.id)}
                  role="menuitem"
                  className={itemClassName}
                  tabIndex={tabIndex}
                  href={item.href}
                  onClick={() => activate(item)}
                  onKeyDown={onItemKeyDown}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <button
                key={item.id}
                ref={setItemRef(item.id)}
                type="button"
                role="menuitem"
                className={itemClassName}
                tabIndex={tabIndex}
                // Use aria-disabled (not the native attribute) so the disabled
                // item keeps its role and accessible name in the menu while
                // being inert: roving focus skips it and activate() is a no-op.
                aria-disabled={item.disabled || undefined}
                onClick={() => activate(item)}
                onKeyDown={onItemKeyDown}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
