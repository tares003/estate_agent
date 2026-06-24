import { describe, expect, it } from 'vitest';

import {
  COOKIE_CONSENT_COOKIE,
  DENY_ALL_CONSENT,
  isCategoryGranted,
  parseConsentCookie,
  serialiseConsent,
} from './cookie-consent.js';

// EPIC-C FR-C-12 — pure cookie-consent helpers. The persisted decision lives in a
// single first-party cookie; non-essential scripts are gated on the parsed
// decision. DB-free so the gating logic is unit-tested in isolation.

describe('DENY_ALL_CONSENT', () => {
  it('keeps necessary on and every non-essential category off (the pre-consent default)', () => {
    expect(DENY_ALL_CONSENT).toEqual({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
  });
});

describe('serialiseConsent / parseConsentCookie', () => {
  it('round-trips a decision through the cookie value', () => {
    const decision = { necessary: true, analytics: true, marketing: false, preferences: true };
    const round = parseConsentCookie(serialiseConsent(decision));
    expect(round).toEqual(decision);
  });

  it('returns null for a missing cookie (no decision recorded yet)', () => {
    expect(parseConsentCookie(undefined)).toBeNull();
    expect(parseConsentCookie('')).toBeNull();
  });

  it('returns null for a malformed cookie value (fail to no-consent, banner re-shows)', () => {
    expect(parseConsentCookie('not-json')).toBeNull();
    expect(parseConsentCookie('{"analytics":true}')).toBeNull();
  });

  it('coerces necessary back to true even if a tampered cookie set it false', () => {
    const parsed = parseConsentCookie(
      serialiseConsent({ necessary: true, analytics: false, marketing: false, preferences: false }).replace(
        '"necessary":true',
        '"necessary":false',
      ),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.necessary).toBe(true);
  });
});

describe('isCategoryGranted', () => {
  const decision = { necessary: true, analytics: true, marketing: false, preferences: false };

  it('necessary is always granted, even with no decision', () => {
    expect(isCategoryGranted(null, 'necessary')).toBe(true);
    expect(isCategoryGranted(decision, 'necessary')).toBe(true);
  });

  it('a non-essential category is granted only when the decision opts in', () => {
    expect(isCategoryGranted(decision, 'analytics')).toBe(true);
    expect(isCategoryGranted(decision, 'marketing')).toBe(false);
    expect(isCategoryGranted(decision, 'preferences')).toBe(false);
  });

  it('a non-essential category is denied when no decision exists (gate closed pre-consent)', () => {
    expect(isCategoryGranted(null, 'analytics')).toBe(false);
    expect(isCategoryGranted(null, 'marketing')).toBe(false);
  });
});

describe('COOKIE_CONSENT_COOKIE', () => {
  it('is a stable first-party cookie name', () => {
    expect(COOKIE_CONSENT_COOKIE).toBe('estate_cookie_consent');
  });
});
