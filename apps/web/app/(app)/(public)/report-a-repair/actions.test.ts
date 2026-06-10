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
const repairCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ repairRequest: { create: repairCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

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
});

describe('submitRepairRequest', () => {
  it('records consent + a repair_request + an audit row (G4/G5)', async () => {
    const result = await submitRepairRequest({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'repair_form', subject: 'tess@example.com' }),
    );
    expect(repairCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Tess Tenant',
        email: 'tess@example.com',
        phone: '07700900000',
        reference: 'Flat 2, 14 Palatine Road',
        category: 'Plumbing',
        description: 'The kitchen tap is leaking steadily under the sink.',
        urgency: 'urgent',
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_request.created',
        entity: 'repair_request',
        entityId: 'rep-1',
      }),
    );
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
});
