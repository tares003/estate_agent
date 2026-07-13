import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-T FR-T-3 — the customer sign-in action. A registered customer
// authenticates with email + password and is returned to the route they were
// trying to reach (`?next=`). Mirrors the registration action's injectable-seam
// shape: the Zod schema validates the input, then the `signInCustomer` seam
// (better-auth signInEmail → session cookie set via nextCookies) authenticates.
// On success the action emits a `customer.signed_in` audit row in ONE tenant
// transaction (G4 — a sign-in creates a session row, a state change) and returns
// the SANITISED redirect target. Fail-closed: bad input, or a rejected
// credential, authenticates nothing, writes nothing, and reveals nothing about
// which half of the credential was wrong.

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const verifyTurnstile = vi.fn();
vi.mock('../../lib/turnstile.js', () => ({
  verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a),
}));

const signInCustomer = vi.fn();
vi.mock('../../lib/customer-sign-in.js', () => ({
  signInCustomer: (...a: unknown[]) => signInCustomer(...a),
}));

const audit = vi.fn();
const auditCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ auditLog: { create: auditCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { submitSignIn } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '22222222-2222-2222-2222-222222222222';

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', 'penny@example.invalid');
  fd.set('password', 'correct horse battery');
  fd.set('cf-turnstile-response', 'tok');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  verifyTurnstile.mockResolvedValue(true);
  signInCustomer.mockResolvedValue({ ok: true, userId: USER });
});

describe('submitSignIn', () => {
  it('rejects an invalid submission (Zod) before authenticating or writing', async () => {
    const res = await submitSignIn({ ok: false }, form({ email: 'nope' }));
    expect(res.ok).toBe(false);
    expect(signInCustomer).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  // Audit finding sign-in-missing-turnstile-g8: the credential endpoint is a
  // public form submission, so the Turnstile challenge must be verified
  // server-side BEFORE authenticating or writing (CLAUDE.md §9, G8) — matching
  // register/forgot-password. Unthrottled sign-in invites credential stuffing.
  it('fails closed when the Turnstile challenge does not verify — no auth, no audit', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const res = await submitSignIn({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(signInCustomer).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('verifies Turnstile BEFORE authenticating (G8)', async () => {
    await submitSignIn({ ok: false }, form());
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.7');
    expect(verifyTurnstile.mock.invocationCallOrder[0]!).toBeLessThan(
      signInCustomer.mock.invocationCallOrder[0]!,
    );
  });

  it('authenticates with the validated email/password (FR-T-3)', async () => {
    await submitSignIn({ ok: false }, form());
    expect(signInCustomer).toHaveBeenCalledTimes(1);
    expect(signInCustomer.mock.calls[0]![0]).toMatchObject({
      email: 'penny@example.invalid',
      password: 'correct horse battery',
    });
  });

  it('emits a customer.signed_in audit row in one tenant transaction on success (G4)', async () => {
    const res = await submitSignIn({ ok: false }, form());
    expect(res.ok).toBe(true);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      action: 'customer.signed_in',
      entity: 'user',
      entityId: USER,
    });
  });

  it('fails closed when the credential is rejected — no audit, generic error', async () => {
    signInCustomer.mockResolvedValue({ ok: false, reason: 'invalid_credentials' });
    const res = await submitSignIn({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(audit).not.toHaveBeenCalled();
    // The error must NOT disclose WHICH half of the credential was wrong: the
    // standard non-enumerating phrasing names both factors ("email or password")
    // so it reveals neither. It must never single out the account's existence.
    const message = res.errors?.map((e) => e.message).join(' ') ?? '';
    expect(message).not.toMatch(/no account|not found|unknown email|no such user|wrong password/i);
    // And it must not carry a field link that would pin the blame on one input.
    expect(res.errors?.every((e) => e.field === undefined)).toBe(true);
  });

  it('returns the sanitised next path (a same-origin relative route) on success', async () => {
    const res = await submitSignIn({ ok: false }, form({ next: '/account/saved' }));
    expect(res.ok).toBe(true);
    expect(res.redirectTo).toBe('/account/saved');
  });

  it('defaults the redirect to /account when no next is supplied', async () => {
    const res = await submitSignIn({ ok: false }, form());
    expect(res.ok).toBe(true);
    expect(res.redirectTo).toBe('/account');
  });

  it('rejects an off-site next (open-redirect defence), falling back to /account', async () => {
    const res = await submitSignIn({ ok: false }, form({ next: 'https://evil.example/phish' }));
    expect(res.ok).toBe(true);
    expect(res.redirectTo).toBe('/account');
  });

  it('rejects a protocol-relative next (//evil.example), falling back to /account', async () => {
    const res = await submitSignIn({ ok: false }, form({ next: '//evil.example/phish' }));
    expect(res.ok).toBe(true);
    expect(res.redirectTo).toBe('/account');
  });

  it('does not write an audit row when authentication fails', async () => {
    signInCustomer.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const res = await submitSignIn({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
