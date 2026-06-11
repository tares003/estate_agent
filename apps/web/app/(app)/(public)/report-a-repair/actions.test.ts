import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (repairRequestSchema) drives the rules; the data layer,
// request context and anti-spam verifier are doubled so the action is exercised in
// isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const verifyTurnstile = vi.fn();
vi.mock('../../lib/turnstile.js', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

const audit = vi.fn();
const recordConsent = vi.fn();
const notify = vi.fn();
const repairCreate = vi.fn();
const repairCount = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ repairRequest: { create: repairCreate, count: repairCount } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent, notify }));

const { submitRepairRequest } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: 'Tess Tenant',
    email: 'tess@example.com',
    phone: '07700900000',
    propertyReference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    description: 'The kitchen tap is leaking steadily under the sink.',
    urgency: 'urgent',
    gdpr_consent: 'on',
    'cf-turnstile-response': 'turnstile-token',
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  verifyTurnstile.mockResolvedValue(true);
  repairCreate.mockResolvedValue({ id: 'rep-1' });
  repairCount.mockResolvedValue(41);
});

describe('submitRepairRequest', () => {
  it('records consent + the ticket (with its §G.1 reference) + audit + the queued confirmation (G4/G5, FR-G-3)', async () => {
    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(result.reference).toMatch(/^RPR-\d{4}-00042$/); // count 41 → next sequence 42
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'repair_form', subject: 'tess@example.com' }),
    );
    expect(repairCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Tess Tenant',
        email: 'tess@example.com',
        reference: result.reference,
        propertyReference: 'Flat 2, 14 Palatine Road',
        category: 'Plumbing',
        urgency: 'urgent',
      }),
    });
    // the tenant confirmation is QUEUED in the same transaction (§H.13 — the
    // worker dispatches; the action only records intent)
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        event: 'repair_request.received',
        channel: 'email',
        recipient: 'tess@example.com',
        payload: expect.objectContaining({ reference: result.reference }),
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'repair_request.created', entityId: 'rep-1' }),
    );
  });

  it('retries once when the reference collides under concurrency (unique violation)', async () => {
    withTenant
      .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
      .mockImplementationOnce(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
        fn({ repairRequest: { create: repairCreate, count: repairCount } }),
      );

    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(withTenant).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid submission before any write', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('rejects an unknown urgency before any write', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ urgency: 'whenever' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only required field as missing (no write)', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ description: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'description' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('requires consent', async () => {
    const result = await submitRepairRequest({ ok: false }, form({ gdpr_consent: 'off' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when the anti-spam challenge does not verify (no writes)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await submitRepairRequest({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(repairCreate).not.toHaveBeenCalled();
  });

  it('passes the verified Turnstile token to the anti-spam check', async () => {
    await submitRepairRequest({ ok: false }, form());
    expect(verifyTurnstile).toHaveBeenCalledWith('turnstile-token', '203.0.113.7');
  });
});
