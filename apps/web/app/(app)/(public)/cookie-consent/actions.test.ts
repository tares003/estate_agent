import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (cookieConsentSchema) drives the rules; the data layer,
// request context and the cookie store are doubled so the action is exercised in
// isolation. The cookie banner is an ANONYMOUS consent-preference capture (master
// spec §J Consent log) — no personal data, so no Turnstile / gdpr_consent here
// (those gate personal-data lead forms). The decision is still tenant-scoped (RLS),
// written to consent_logs, and audited (G4).

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const cookieGet = vi.fn();
const cookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: cookieGet, set: cookieSet }),
}));

const audit = vi.fn();
const recordConsent = vi.fn();
const consentLogCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ consentLog: { create: consentLogCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

const { recordCookieConsent } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  cookieGet.mockReturnValue(undefined);
});

describe('recordCookieConsent', () => {
  it('records the decision to consent_logs + an audit row, and persists the cookie (G4)', async () => {
    const result = await recordCookieConsent({
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: true,
    });

    expect(result).toEqual({ ok: true });

    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        scope: 'cookie_banner',
        ipAddress: '203.0.113.7',
      }),
    );
    // the agreed categories are captured verbatim in the consent text
    const consentArg = recordConsent.mock.calls[0]?.[1] as { consentText: string; subject: string };
    expect(consentArg.consentText).toContain('analytics');
    // the subject is an anonymous session identifier (no personal data)
    expect(consentArg.subject).toMatch(/^anon:/);

    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        action: 'cookie_consent.recorded',
        entity: 'consent_log',
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (Test)',
      }),
    );

    // the persisted cookie carries the decision so the banner stays dismissed
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = cookieSet.mock.calls[0] ?? [];
    expect(name).toBe('estate_cookie_consent');
    expect(JSON.parse(value as string)).toMatchObject({ analytics: true, marketing: false });
    expect(options).toMatchObject({ httpOnly: false, sameSite: 'lax' });
  });

  it('reuses an existing anonymous session id when one is already set', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'estate_anon_session' ? { value: 'sid-existing' } : undefined,
    );

    await recordCookieConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    });

    const consentArg = recordConsent.mock.calls[0]?.[1] as { subject: string };
    expect(consentArg.subject).toBe('anon:sid-existing');
    // it does NOT mint a new session id when one exists
    const setNames = cookieSet.mock.calls.map((c) => c[0]);
    expect(setNames).not.toContain('estate_anon_session');
  });

  it('rejects a decision that opts out of necessary cookies — no write', async () => {
    const result = await recordCookieConsent({
      necessary: false,
      analytics: false,
      marketing: false,
      preferences: false,
    } as never);

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
