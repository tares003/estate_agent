import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-N FR-N-5 — the password-reset CONSUME action (`/reset-password`). The visitor
// sets a NEW password, carrying the opaque single-use token from the email. It
// captures NO new personal data (only a secret + the opaque token), so no GDPR
// consent / Turnstile gate applies — the token itself is the authorisation. It
// delegates to the injectable resetPassword seam (better-auth consumes the token:
// verifies + expires it, re-hashes the password FR-N-1) and, on success, writes an
// audit row in a tenant transaction (G4). Fail-closed: an invalid form or a
// rejected token writes nothing.

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const resetPassword = vi.fn();
vi.mock('../../lib/password-reset.js', () => ({
  resetPassword: (...a: unknown[]) => resetPassword(...a),
}));

const audit = vi.fn();
const auditCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ auditLog: { create: auditCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { submitResetPassword } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '22222222-2222-2222-2222-222222222222';
const TOKEN = 'aZ09aZ09aZ09aZ09aZ09aZ09';

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('token', TOKEN);
  fd.set('password', 'correct horse battery');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  resetPassword.mockResolvedValue({ ok: true, userId: USER });
});

describe('submitResetPassword', () => {
  it('rejects a password below the minimum length (Zod) before any reset', async () => {
    const res = await submitResetPassword({ ok: false }, form({ password: 'short' }));
    expect(res.ok).toBe(false);
    expect(resetPassword).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a missing token before any reset', async () => {
    const fd = form();
    fd.delete('token');
    const res = await submitResetPassword({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('consumes the token with the new password (FR-N-5)', async () => {
    await submitResetPassword({ ok: false }, form());
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword.mock.calls[0]![0]).toMatchObject({
      token: TOKEN,
      password: 'correct horse battery',
    });
  });

  it('writes an audit row in a tenant transaction on success (G4)', async () => {
    const res = await submitResetPassword({ ok: false }, form());
    expect(res.ok).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      action: 'auth.password_reset_completed',
      entity: 'user',
      entityId: USER,
    });
  });

  it('never logs the new password in the audit diff (no secret leak)', async () => {
    await submitResetPassword({ ok: false }, form());
    expect(JSON.stringify(audit.mock.calls[0]![1].diff ?? {})).not.toContain(
      'correct horse battery',
    );
  });

  it('fails closed when the token is invalid or expired — no audit row', async () => {
    resetPassword.mockResolvedValue({ ok: false, reason: 'invalid_token' });
    const res = await submitResetPassword({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });
});
