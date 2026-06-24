'use client';

import { useState, useTransition } from 'react';
import { Button, Checkbox } from '@estate/ui';
import type { CookieConsentDecision } from '@estate/validators';

import { recordCookieConsent } from '../app/(app)/(public)/cookie-consent/actions.js';

// EPIC-C FR-C-12 / EPIC-N design brief "Cookie banner". A bottom-of-viewport
// banner that cannot be dismissed without a choice: Accept all / Reject
// non-essential / Customise. The Customise panel exposes per-category toggles
// with Necessary forced on (checked + disabled). Each choice persists the
// decision through the server action (consent_logs + audit + cookie); on success
// the banner removes itself so it never reappears for a decided visitor.
//
// Token-driven (G7): surface = bg-surface-base, --shadow-md (shadow-md), required
// markers / supporting copy = text-text-muted; the slide-in uses the
// motion-duration-base / motion-ease-emphasis tokens via the
// `.cookie-banner-enter` class in globals.css. Buttons are real <button>s with
// the @estate/ui focus rings; the region is labelled + role="region" and the
// state change is announced (aria-live) per the design brief's a11y note.

export interface CookieBannerProps {
  /** The visitor's already-recorded decision (server-resolved); null = undecided. */
  initialDecision: CookieConsentDecision | null;
}

const ALL_GRANTED: CookieConsentDecision = {
  necessary: true,
  analytics: true,
  marketing: true,
  preferences: true,
};

const NONE_GRANTED: CookieConsentDecision = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

export function CookieBanner({ initialDecision }: CookieBannerProps) {
  const [dismissed, setDismissed] = useState(initialDecision !== null);
  const [customising, setCustomising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dismissed) {
    return null;
  }

  const submit = (decision: CookieConsentDecision) => {
    startTransition(async () => {
      const result = await recordCookieConsent(decision);
      if (result.ok) {
        setDismissed(true);
      }
    });
  };

  return (
    <section
      aria-label="Cookie consent"
      aria-live="polite"
      className="cookie-banner-enter bg-surface-base border-border fixed inset-x-0 bottom-0 z-50 border-t shadow-md md:inset-x-4 md:bottom-4 md:rounded-lg md:border"
    >
      <div className="container flex flex-col gap-4 py-6">
        <div className="flex flex-col gap-2">
          <h2 className="t-heading-sm">Your cookie choices</h2>
          <p className="t-body-sm text-text-secondary max-w-[60ch]">
            We use cookies to make this site work and to understand how it&rsquo;s used. Choose your
            preferences below. Read our{' '}
            <a href="/cookies" className="underline">
              Cookie Policy
            </a>
            .
          </p>
        </div>

        {customising ? (
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="t-body-sm text-text-muted">
              Necessary cookies are always on. Choose which optional cookies to allow.
            </legend>
            <Checkbox
              name="necessary"
              label="Necessary"
              description="Required for the site to work — always on."
              checked
              disabled
              readOnly
            />
            <Checkbox
              name="analytics"
              label="Analytics"
              description="Help us understand how the site is used."
              checked={analytics}
              onChange={(event) => setAnalytics(event.target.checked)}
            />
            <Checkbox
              name="marketing"
              label="Marketing"
              description="Used to measure and improve our advertising."
              checked={marketing}
              onChange={(event) => setMarketing(event.target.checked)}
            />
            <Checkbox
              name="preferences"
              label="Preferences"
              description="Remember your choices and personalise your experience."
              checked={preferences}
              onChange={(event) => setPreferences(event.target.checked)}
            />
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {customising ? (
            <Button
              type="button"
              loading={pending}
              onClick={() => submit({ necessary: true, analytics, marketing, preferences })}
            >
              Save preferences
            </Button>
          ) : (
            <>
              <Button type="button" loading={pending} onClick={() => submit(ALL_GRANTED)}>
                Accept all
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={pending}
                onClick={() => submit(NONE_GRANTED)}
              >
                Reject non-essential
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setCustomising(true)}
              >
                Customise
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
