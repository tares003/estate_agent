import { describe, expect, it } from 'vitest';

import {
  COOKIE_CONSENT_CATEGORIES,
  NON_ESSENTIAL_COOKIE_CATEGORIES,
  cookieConsentSchema,
  type CookieConsentDecision,
} from './cookie-consent.js';

// EPIC-C FR-C-12 — the cookie-banner consent decision. An anonymous
// consent-preference capture (master spec §J "Consent log": session id +
// categories + IP/UA, no name/email/phone), so it carries NO gdpr_consent
// affirmation — there is no personal data in the decision itself (G5 N/A).

describe('COOKIE_CONSENT_CATEGORIES', () => {
  it('declares the four master-spec categories in order (necessary, analytics, marketing, preferences)', () => {
    expect(COOKIE_CONSENT_CATEGORIES).toEqual([
      'necessary',
      'analytics',
      'marketing',
      'preferences',
    ]);
  });

  it('treats every category except necessary as non-essential (gated)', () => {
    expect(NON_ESSENTIAL_COOKIE_CATEGORIES).toEqual(['analytics', 'marketing', 'preferences']);
    expect(NON_ESSENTIAL_COOKIE_CATEGORIES).not.toContain('necessary');
  });
});

describe('cookieConsentSchema', () => {
  it('accepts a full per-category decision', () => {
    const parsed = cookieConsentSchema.safeParse({
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const decision: CookieConsentDecision = parsed.data;
      expect(decision.analytics).toBe(true);
      expect(decision.marketing).toBe(false);
    }
  });

  it('forces necessary on — a decision that opts out of necessary is rejected', () => {
    const parsed = cookieConsentSchema.safeParse({
      necessary: false,
      analytics: false,
      marketing: false,
      preferences: false,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-boolean category value', () => {
    const parsed = cookieConsentSchema.safeParse({
      necessary: true,
      analytics: 'yes',
      marketing: false,
      preferences: false,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a decision missing a category', () => {
    const parsed = cookieConsentSchema.safeParse({
      necessary: true,
      analytics: true,
      marketing: true,
    });
    expect(parsed.success).toBe(false);
  });

  it('does NOT declare any personal-data field (anonymous consent record, G5 N/A)', () => {
    const parsed = cookieConsentSchema.safeParse({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Object.keys(parsed.data).sort()).toEqual([
        'analytics',
        'marketing',
        'necessary',
        'preferences',
      ]);
    }
  });
});
