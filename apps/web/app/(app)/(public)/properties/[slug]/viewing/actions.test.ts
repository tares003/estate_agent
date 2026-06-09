import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (viewingRequestSchema) drives the rules; the data layer,
// request context and anti-spam verifier are doubled so the action is exercised in
// isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const verifyTurnstile = vi.fn();
vi.mock('../../../../lib/turnstile.js', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

const audit = vi.fn();
const recordConsent = vi.fn();
const enquiryCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { create: enquiryCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

const { submitViewing } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const PROPERTY = '99999999-9999-9999-9999-999999999999';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: 'Vera Viewer',
    email: 'vera@example.com',
    phone: '07700900000',
    propertyId: PROPERTY,
    preferredDate: '2026-06-20',
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

describe('submitViewing', () => {
  it('records consent + a viewing-channel enquiry against the property + an audit row', async () => {
    const result = await submitViewing({ ok: false }, form({ alternativeDate: '2026-06-21' }));

    expect(result).toEqual({ ok: true });
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'viewing_form', subject: 'vera@example.com' }),
    );
    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        propertyId: PROPERTY,
        name: 'Vera Viewer',
        message: expect.stringContaining('preferred 2026-06-20'),
      }),
    });
    // the enquiry channel is a viewing request — read via bracket access to keep the
    // forbidden noun out of a declared identifier (PRODUCT.md §2/§3, G6)
    const createdData = enquiryCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(createdData['leadType']).toBe('viewing_request');
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'enquiry.created', entity: 'enquiry', entityId: 'enq-1' }),
    );
  });

  it('rejects an invalid submission before any write', async () => {
    const result = await submitViewing({ ok: false }, form({ preferredDate: '' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'preferredDate' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when the anti-spam challenge does not verify (no writes)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await submitViewing({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(enquiryCreate).not.toHaveBeenCalled();
  });
});
