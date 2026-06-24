'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { toggleSavedProperty } from './actions.js';

// EPIC-T FR-T-6 — the saved-property heart. Reflects the persisted saved state and
// toggles it with an OPTIMISTIC flip (the row behind it is what survives navigation
// + sign-out/sign-in). Design-token classes only (G7): filled =
// --colour-brand-accent (text-brand-accent), unfilled = --colour-text-muted
// (text-text-muted); the press pulse uses the motion-duration-fast token, disabled
// under reduced motion by the global base stylesheet.
//
// Signed out, it is a LINK to /sign-in?next=<current path> rather than a toggle —
// the deferred "replay the save after auth" (FR-T-5) is a NOTED follow-on, not built
// in this slice.

export interface SavePropertyButtonProps {
  /** The catalogue property this heart saves. */
  propertyId: string;
  /** Whether a verified customer is signed in (server-resolved). */
  signedIn: boolean;
  /** The persisted saved state for this property (ignored when signed out). */
  initialSaved: boolean;
  /** The path to return to after sign-in (signed-out variant); defaults to the property. */
  currentPath?: string;
  className?: string;
}

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
  </svg>
);

const BASE_CLASS =
  'inline-flex items-center gap-2 transition-transform duration-fast active:scale-110';

export function SavePropertyButton({
  propertyId,
  signedIn,
  initialSaved,
  currentPath,
  className,
}: SavePropertyButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

  // Signed out — link to sign-in, preserving the route to return to (FR-T-5).
  if (!signedIn) {
    const next = encodeURIComponent(currentPath ?? `/properties`);
    return (
      <a
        href={`/sign-in?next=${next}`}
        className={cx(BASE_CLASS, 'text-text-muted', className)}
        aria-label="Save property — sign in to save"
      >
        <HeartIcon filled={false} />
        <span>Save</span>
      </a>
    );
  }

  const onToggle = () => {
    const next = !saved;
    setSaved(next); // optimistic
    startTransition(async () => {
      const fd = new FormData();
      fd.set('propertyId', propertyId);
      const result = await toggleSavedProperty({ ok: false }, fd);
      if (!result.ok) {
        setSaved(!next); // revert on failure
        return;
      }
      setSaved(result.saved ?? next);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved properties' : 'Save property'}
      className={cx(BASE_CLASS, saved ? 'text-brand-accent' : 'text-text-muted', className)}
    >
      <HeartIcon filled={saved} />
      <span>{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
