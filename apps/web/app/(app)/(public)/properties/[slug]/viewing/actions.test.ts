import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (viewingRequestSchema) drives the rules; the data layer,
// request context and anti-spam verifier are doubled so the action is exercised in
// isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const verifyTurnstile = vi.fn();
vi.mock('../../../../lib/turnstile.js', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

const audit = vi.fn();
const recordConsent = vi.fn();
const enquiryCreate = vi.fn();
const ruleFindMany = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { create: enquiryCreate }, assignmentRule: { findMany: ruleFindMany } }),
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
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  verifyTurnstile.mockResolvedValue(true);
  enquiryCreate.mockResolvedValue({ id: 'enq-1' });
  ruleFindMany.mockResolvedValue([]);
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

  // Audit finding assignment-rules-never-applied (FR-I-3): the viewing-channel
  // enquiry is routed through the tenant's assignment rules at creation.
  it('records the request user-agent alongside the IP on the audit row (FR-H-17 / FR-N-14)', async () => {
    // PR #152 threaded getRequestUserAgent through the ADMIN actions only, leaving every
    // public submission's audit row with user_agent = null. Provenance is IP + UA.
    await submitViewing({ ok: false }, form({ alternativeDate: '2026-06-21' }));
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Test)' }),
    );
  });

  it('applies the first-matching assignment rule and persists the target (FR-I-3)', async () => {
    const BRANCH = '00000000-0000-0000-0000-00000000000b';
    ruleFindMany.mockResolvedValue([
      {
        name: 'Viewings to the branch',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'viewing_request' }],
        assignment: { targetType: 'branch', targetId: BRANCH },
      },
    ]);

    await submitViewing({ ok: false }, form());

    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedAgentId: null, assignedBranchId: BRANCH }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'enquiry.created',
        diff: expect.objectContaining({ assignedBranchId: [null, BRANCH] }),
      }),
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
