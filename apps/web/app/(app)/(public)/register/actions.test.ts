import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-T FR-T-1 — the customer-registration action. A PUBLIC form, so it is held to
// the same compliance gates as the contact action: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim), Turnstile verified BEFORE
// any write (CLAUDE.md §9). It creates a `type=customer` user via the injectable
// registerCustomer seam (which wraps better-auth signUpEmail + the verification
// magic-link), then records consent + an audit row in ONE tenant transaction (G4).
// Mirrors the contact + saved-property action tests' injectable-seam pattern.

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

const registerCustomer = vi.fn();
vi.mock('../../lib/customer-register.js', () => ({
  registerCustomer: (...a: unknown[]) => registerCustomer(...a),
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

const { submitRegister } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '22222222-2222-2222-2222-222222222222';

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('name', 'Penny Pomeroy');
  fd.set('email', 'penny@example.invalid');
  fd.set('password', 'correct horse battery');
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
  registerCustomer.mockResolvedValue({ ok: true, userId: USER });
});

describe('submitRegister', () => {
  it('rejects an invalid submission (Zod) before any write or user creation', async () => {
    const res = await submitRegister({ ok: false }, form({ email: 'nope' }));
    expect(res.ok).toBe(false);
    expect(registerCustomer).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a submission with GDPR consent unticked (G5 — fail-closed)', async () => {
    const fd = form();
    fd.delete('gdpr_consent');
    const res = await submitRegister({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(registerCustomer).not.toHaveBeenCalled();
  });

  it('fails closed when the Turnstile challenge does not verify — no user, no write', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const res = await submitRegister({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(registerCustomer).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('verifies Turnstile BEFORE creating the user', async () => {
    await submitRegister({ ok: false }, form());
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(verifyTurnstile).toHaveBeenCalledWith('tok', '203.0.113.7');
    expect(registerCustomer).toHaveBeenCalledTimes(1);
  });

  it('creates a customer with the validated name/email/password (FR-T-1)', async () => {
    await submitRegister({ ok: false }, form());
    expect(registerCustomer).toHaveBeenCalledTimes(1);
    expect(registerCustomer.mock.calls[0]![0]).toMatchObject({
      name: 'Penny Pomeroy',
      email: 'penny@example.invalid',
      password: 'correct horse battery',
    });
  });

  it('records consent + an audit row in one tenant transaction on success (G4/G5)', async () => {
    const res = await submitRegister({ ok: false }, form());
    expect(res.ok).toBe(true);
    expect(recordConsent).toHaveBeenCalledTimes(1);
    expect(recordConsent.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      scope: 'customer_registration',
      subject: 'penny@example.invalid',
    });
    // The exact affirmation text must be persisted verbatim.
    expect(typeof recordConsent.mock.calls[0]![1].consentText).toBe('string');
    expect(recordConsent.mock.calls[0]![1].consentText.length).toBeGreaterThan(0);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      tenantId: TENANT,
      action: 'customer.registered',
      entity: 'user',
      entityId: USER,
    });
  });

  it('does not write consent/audit when user creation fails (e.g. email already in use)', async () => {
    registerCustomer.mockResolvedValue({ ok: false });
    const res = await submitRegister({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('passes the marketing opt-in flag through when ticked', async () => {
    await submitRegister({ ok: false }, form({ marketingOptIn: 'on' }));
    expect(registerCustomer.mock.calls[0]![0]).toMatchObject({ marketingOptIn: true });
  });
});
