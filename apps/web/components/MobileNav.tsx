'use client';

import { useEffect, useRef, useState } from 'react';

import type { NavItem } from '../app/(app)/lib/menu-mapper.js';
import { SiteNav } from './SiteNav.js';

// design-requirements.md §3: below --breakpoint-md the desktop nav collapses to a
// logo + hamburger. This is the hamburger half — a client disclosure that toggles
// the stacked primary nav. Rendered inside SiteHeader with `md:hidden`; the desktop
// `SiteNav` sits beside it under `hidden md:block`, so exactly one Primary nav is in
// the a11y tree per breakpoint.
//
// Accessible: the toggle is a real <button> carrying aria-expanded + aria-controls;
// Escape closes and returns focus to the button; a pointer-down outside the header
// closes it; activating any link closes it (the nav then moves focus itself). The
// reveal animation lives in globals.css (`.mobile-nav-enter`, motion-duration-base /
// motion-ease-standard, disabled under reduced motion — G7, no raw ms/easing).

const PANEL_ID = 'mobile-nav-panel';

/** Two-bar-to-cross hamburger, sized in rem (h-6/w-6) and inheriting currentColor. */
function ToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="7" x2="21" y2="7" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="17" x2="21" y2="17" />
        </>
      )}
    </svg>
  );
}

export function MobileNav({
  items,
  currentPath,
}: {
  items: NavItem[];
  currentPath?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
        className="text-text-primary hover:text-brand-primary inline-flex min-h-[var(--size-touch-target-min)] min-w-[var(--size-touch-target-min)] items-center justify-center"
      >
        <ToggleIcon open={open} />
      </button>

      {open ? (
        <div
          id={PANEL_ID}
          className="mobile-nav-enter bg-surface-base border-border absolute inset-x-0 top-full z-40 border-b shadow-md"
        >
          <div className="container py-4">
            <SiteNav
              items={items}
              currentPath={currentPath}
              orientation="vertical"
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
