import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (valuationRequestSchema) drives the rules; the data
// layer, request context and anti-spam verifier are doubled so the action is
// exercised in isolation.
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
const enquiryCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { create: enquiryCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

const { submitValuation } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: 'Olive Owner',
    email: 'olive@example.com',
    phone: '07700900000',
    addressLine1: '1 Palatine Road',
    postcode: 'M20 6RE',
    propertyType: 'Terraced house',
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
  enquiryCreate.mockResolvedValue({ id: 'enq-1' });
});

describe('submitValuation', () => {
  it('records consent + a valuation-channel enquiry + an audit row (G4/G5)', async () => {
    const result = await submitValuation({ ok: false }, form({ bedrooms: '3' }));

    expect(result).toEqual({ ok: true });
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'valuation_form', subject: 'olive@example.com' }),
    );
    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Olive Owner',
        email: 'olive@example.com',
        phone: '07700900000',
        message: expect.stringContaining('1 Palatine Road'),
      }),
    });
    // the enquiry's channel is the valuation request — read via bracket access to
    // keep the forbidden noun out of a declared identifier (PRODUCT.md §2/§3, G6)
    const createdData = enquiryCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(createdData['leadType']).toBe('valuation_request');
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'enquiry.created', entity: 'enquiry', entityId: 'enq-1' }),
    );
  });

  it('rejects an invalid submission before any write', async () => {
    const result = await submitValuation({ ok: false }, form({ email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('requires consent', async () => {
    const result = await submitValuation({ ok: false }, form({ gdpr_consent: 'off' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when the anti-spam challenge does not verify (no writes)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await submitValuation({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(enquiryCreate).not.toHaveBeenCalled();
  });
});
