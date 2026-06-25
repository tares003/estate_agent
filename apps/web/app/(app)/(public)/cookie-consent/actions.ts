'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

import { cookieConsentSchema, type CookieConsentDecision } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../lib/tenant.js';
import { COOKIE_CONSENT_COOKIE, serialiseConsent } from '../../lib/cookie-consent.js';

// EPIC-C FR-C-12 — persist the cookie-banner consent decision. This is the GDPR
// consent primitive itself (master spec §J "Consent log"), NOT a personal-data
// lead form: the record is anonymous (an opaque session id + the categories +
// IP/UA — no name/email/phone), so there is no Turnstile gate and no
// `gdpr_consent` affirmation (those guard personal-data forms that create leads).
// The decision is still tenant-scoped (RLS), written to consent_logs via the G5
// recordConsent() helper, and audited (G4) in the SAME transaction. The decision
// is then mirrored into a readable first-party cookie so the banner stays
// dismissed and the server-side script gate (ConsentGatedScript) can read it.

/** A session cookie that ties repeat consent decisions to one anonymous visitor. */
const ANON_SESSION_COOKIE = 'estate_anon_session';

/** One year — the consent decision (and the anon id) persist across visits. */
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface CookieConsentWriteClient extends ConsentWriter, AuditWriter {}

/** The result of recording a cookie-consent decision. */
export interface CookieConsentState {
  ok: boolean;
}

/** Human-readable record of exactly which categories the visitor agreed to. */
function consentText(decision: CookieConsentDecision): string {
  const granted = ['necessary'];
  if (decision.analytics) granted.push('analytics');
  if (decision.marketing) granted.push('marketing');
  if (decision.preferences) granted.push('preferences');
  return `Cookie consent recorded. Categories accepted: ${granted.join(', ')}.`;
}

export async function recordCookieConsent(
  decision: CookieConsentDecision,
): Promise<CookieConsentState> {
  const parsed = cookieConsentSchema.safeParse(decision);
  if (!parsed.success) {
    return { ok: false };
  }
  const verdict = parsed.data;

  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();
  const store = await cookies();

  // Reuse the visitor's anonymous session id, or mint one. The consent subject is
  // this opaque id (master spec §J) — never personal data.
  const existingSessionId = store.get(ANON_SESSION_COOKIE)?.value;
  const sessionId = existingSessionId ?? randomUUID();
  const subject = `anon:${sessionId}`;

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as CookieConsentWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'cookie_banner',
      subject,
      consentText: consentText(verdict),
      ipAddress: ip,
    });
    await audit(tx, {
      tenantId,
      actor: subject,
      action: 'cookie_consent.recorded',
      entity: 'consent_log',
      diff: {
        analytics: verdict.analytics,
        marketing: verdict.marketing,
        preferences: verdict.preferences,
      },
      ip,
      userAgent,
    });
  });

  // Mirror the decision into a readable first-party cookie (httpOnly:false — the
  // client banner reads it to stay dismissed; it carries no secret). Persist the
  // anon id only when freshly minted.
  if (existingSessionId === undefined) {
    store.set(ANON_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: CONSENT_MAX_AGE_SECONDS,
    });
  }
  store.set(COOKIE_CONSENT_COOKIE, serialiseConsent(verdict), {
    httpOnly: false,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });

  return { ok: true };
}
