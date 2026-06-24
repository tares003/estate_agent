/**
 * Cookie-banner consent decision (EPIC-C FR-C-12; master spec §C.20 / §J
 * "Consent log" / line 361 categories).
 *
 * The banner captures a granular, per-category decision: `necessary` is always
 * on (the site cannot function without it), the other three are opt-in. The
 * persisted record is ANONYMOUS — master spec §J's consent log is an optional
 * user reference + a session identifier + the categories + IP/UA, with NO name /
 * email / phone. The decision therefore carries no personal-data field and so no
 * `gdpr_consent` affirmation is required (CI guard G5 applies to personal-data
 * forms; this is the consent primitive itself, not a lead form).
 */

import { z } from 'zod';

/** The four consent categories, in display order (master spec line 361). */
export const COOKIE_CONSENT_CATEGORIES = [
  'necessary',
  'analytics',
  'marketing',
  'preferences',
] as const;

/** A single consent category. */
export type CookieConsentCategory = (typeof COOKIE_CONSENT_CATEGORIES)[number];

/**
 * The categories whose scripts are GATED — everything except `necessary`. These
 * are the ones the banner toggles and the script gate withholds until granted.
 */
export const NON_ESSENTIAL_COOKIE_CATEGORIES = COOKIE_CONSENT_CATEGORIES.filter(
  (category): category is Exclude<CookieConsentCategory, 'necessary'> => category !== 'necessary',
);

/**
 * The consent decision. Every category is an explicit boolean; `necessary` must
 * be `true` (the site cannot run without essential cookies, so a decision that
 * opts out of it is rejected). No personal data — see the module note (G5 N/A).
 */
export const cookieConsentSchema = z.object({
  necessary: z.literal(true, {
    errorMap: () => ({ message: 'Necessary cookies are required for the site to work.' }),
  }),
  analytics: z.boolean(),
  marketing: z.boolean(),
  preferences: z.boolean(),
});

export type CookieConsentDecision = z.infer<typeof cookieConsentSchema>;
