import { cookies } from 'next/headers';

import {
  COOKIE_CONSENT_COOKIE,
  parseConsentCookie,
  type CookieConsentDecision,
} from './cookie-consent.js';

/**
 * Read the visitor's recorded consent decision from the request cookie (EPIC-C
 * FR-C-12), or null when none has been recorded yet. The single request-bound
 * seam over the pure helpers in `cookie-consent.ts`; the banner's initial
 * dismissed/shown state and every `ConsentGatedScript` gate read through this.
 * Coverage-excluded as request glue (mirrors db.ts / cms.ts) — its parse logic is
 * unit-tested in cookie-consent.test.ts and its callers mock it.
 */
export async function readConsentDecision(): Promise<CookieConsentDecision | null> {
  const store = await cookies();
  return parseConsentCookie(store.get(COOKIE_CONSENT_COOKIE)?.value);
}
