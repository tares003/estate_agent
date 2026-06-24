import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-N FR-N-5 — the password-reset REQUEST action (`/forgot-password`). A PUBLIC
// form, held to the same compliance gates as register: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim), Turnstile verified BEFORE
// any side effect (CLAUDE.md §9). It asks better-auth to mint a reset token (via the
// injectable requestPasswordReset seam, which queues the per-tenant reset email),
// then records consent + an audit row in ONE tenant transaction (G4). It ALWAYS
// returns the same neutral success state — whether or not the email matches an
// account — so the form never reveals which addresses are registered (account
// enumeration). Mirrors the register action test's injectable-seam pattern.

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const verifyTurnstile = vi.fn();
vi.mock('../../lib/turnstile.js', () => ({ verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a) }));

const requestPasswordReset = vi.fn();
vi.mock('../../lib/password-reset.js', () => ({
  requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
}));

const recordConsent = vi.fn();
const audit = vi.fn();
const consentCreate = vi.fn();
const auditCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    consentLog: { create: consentCreate },
    auditLog: { create: auditCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, recordConsent, audit }));

const { submitForgotPassword } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', 'penny@example.invalid');
  fd.set('gdpr_consent', 'on');
  fd.set('cf-turnstile-response', 'tok');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  verifyTurnstile.mockResolvedValue(true);
  requestPasswordReset.mockResolvedValue(undefined);
});

describe('submitForgotPassword', () => {
  it('rejects a malformed email (Zod) before any side effect', async () => {
    const res = await submitForgotPassword({ ok: false }, form({ email: 'nope' }));
    expect(res.ok).toBe(false);
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a submission with GDPR consent unticked (G5 — fail-closed)', async () => {
    const fd = form();
    fd.delete('gdpr_consent');
    const res = await submitForgotPassword({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('fails closed when the Turnstile challenge does not verify — no token, no write', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const res = await submitForgotPassword({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('verifies Turnstile BEFORE requesting the reset', async () => {
    await submitForgotPassword({ ok: false }, form());
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.7');
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it('requests the reset for the validated (lowercased) email (FR-N-5)', async () => {
    await submitForgotPassword({ ok: false }, form({ email: '  Penny@Example.Invalid ' }));
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset.mock.calls[0]![0]).toMatchObject({ email: 'penny@example.invalid' });
  });

  it('records consent + an audit row in one tenant transaction on success (G4/G5)', async () => {
    const res = await submitForgotPassword({ ok: false }, form());
    expect(res.ok).toBe(true);
    expect(recordConsent).toHaveBeenCalledTimes(1);
    expect(recordConsent.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      scope: 'password_reset_request',
      subject: 'penny@example.invalid',
    });
    expect(typeof recordConsent.mock.calls[0]![1].consentText).toBe('string');
    expect(recordConsent.mock.calls[0]![1].consentText.length).toBeGreaterThan(0);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      action: 'auth.password_reset_requested',
      entity: 'user',
    });
  });

  it('does not log the email address in the audit diff (no PII leak)', async () => {
    await submitForgotPassword({ ok: false }, form());
    const diff = audit.mock.calls[0]![1].diff;
    expect(JSON.stringify(diff ?? {})).not.toContain('penny@example.invalid');
  });

  it('returns the same neutral success even when the reset seam reports no such account (no enumeration)', async () => {
    requestPasswordReset.mockResolvedValue(undefined);
    const res = await submitForgotPassword({ ok: false }, form({ email: 'ghost@example.invalid' }));
    expect(res.ok).toBe(true);
  });
});
