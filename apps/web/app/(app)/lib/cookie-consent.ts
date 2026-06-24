/**
 * Pure cookie-consent helpers (EPIC-C FR-C-12). The recorded decision lives in a
 * single first-party cookie; non-essential scripts are gated on the parsed
 * decision. Kept free of `next/headers` so the serialise/parse/gate logic is
 * unit-tested in isolation — the request-bound reads live in
 * `cookie-consent-server.ts`.
 */

import {
  COOKIE_CONSENT_CATEGORIES,
  cookieConsentSchema,
  type CookieConsentCategory,
  type CookieConsentDecision,
} from '@estate/validators';

/** The first-party cookie that persists the visitor's consent decision. */
export const COOKIE_CONSENT_COOKIE = 'estate_cookie_consent';

/**
 * The pre-consent default: only `necessary` is on. Used as the banner's starting
 * point and as the gate's verdict when no decision has been recorded yet.
 */
export const DENY_ALL_CONSENT: CookieConsentDecision = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

/** Serialise a decision to the cookie value (compact JSON). */
export function serialiseConsent(decision: CookieConsentDecision): string {
  return JSON.stringify({
    necessary: true,
    analytics: decision.analytics,
    marketing: decision.marketing,
    preferences: decision.preferences,
  });
}

/**
 * Parse a stored cookie value back into a decision, or null when there is no
 * valid decision (missing / malformed cookie → banner re-shows, gate stays
 * closed). `necessary` is always coerced on, so a tampered cookie cannot turn
 * essential cookies off.
 */
export function parseConsentCookie(value: string | undefined | null): CookieConsentDecision | null {
  if (!value) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = { ...(raw as Record<string, unknown>), necessary: true };
  const parsed = cookieConsentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Is a category granted by the (possibly absent) decision? `necessary` is always
 * granted; any non-essential category is granted only when a decision exists and
 * opted into it — so the gate is closed before any consent is recorded.
 */
export function isCategoryGranted(
  decision: CookieConsentDecision | null,
  category: CookieConsentCategory,
): boolean {
  if (category === 'necessary') return true;
  if (decision === null) return false;
  return decision[category] === true;
}

/** Re-export the category list for callers that render the toggles. */
export { COOKIE_CONSENT_CATEGORIES };
export type { CookieConsentCategory, CookieConsentDecision };
