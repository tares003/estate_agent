import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (buyerEnquirySchema) drives the rules; the data layer,
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
const enquiryCreate = vi.fn();
const ruleFindMany = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { create: enquiryCreate }, assignmentRule: { findMany: ruleFindMany } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, recordConsent }));

const { submitContact } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: 'Casey Caller',
    email: 'casey@example.com',
    message: 'Do you cover the Didsbury area?',
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
  ruleFindMany.mockResolvedValue([]);
});

describe('submitContact', () => {
  it('records consent + a general-contact enquiry + an audit row (G4/G5)', async () => {
    const result = await submitContact({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(recordConsent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scope: 'contact_form', subject: 'casey@example.com' }),
    );
    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Casey Caller',
        email: 'casey@example.com',
        message: 'Do you cover the Didsbury area?',
      }),
    });
    // the enquiry channel is a general contact — read via bracket access to keep the
    // forbidden noun out of a declared identifier (PRODUCT.md §2/§3, G6)
    const createdData = enquiryCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(createdData['leadType']).toBe('general_contact');
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'enquiry.created', entity: 'enquiry', entityId: 'enq-1' }),
    );
  });

  // Audit finding assignment-rules-never-applied (FR-I-3): the enquiry-creation
  // action evaluates the tenant's assignment rules top-down first-match-wins and
  // PERSISTS the winning target on the enquiry, in the same audited tx.
  it('applies the first-matching assignment rule and persists the target (FR-I-3)', async () => {
    const AGENT = '00000000-0000-0000-0000-00000000000a';
    ruleFindMany.mockResolvedValue([
      {
        name: 'General contact to Alex',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'general_contact' }],
        assignment: { targetType: 'agent', targetId: AGENT },
      },
    ]);

    const result = await submitContact({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(ruleFindMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
      orderBy: { position: 'asc' },
    });
    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedAgentId: AGENT, assignedBranchId: null }),
    });
    // G4 — the audit diff records the routing outcome
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'enquiry.created',
        diff: expect.objectContaining({ assignedAgentId: [null, AGENT] }),
      }),
    );
  });

  it('leaves the enquiry unassigned when no rule matches (FR-I-3)', async () => {
    ruleFindMany.mockResolvedValue([
      {
        name: 'Valuations only',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'valuation_request' }],
        assignment: { targetType: 'agent', targetId: '00000000-0000-0000-0000-00000000000a' },
      },
    ]);

    await submitContact({ ok: false }, form());

    expect(enquiryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedAgentId: null, assignedBranchId: null }),
    });
  });

  it('rejects an invalid submission before any write', async () => {
    const result = await submitContact({ ok: false }, form({ email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when the anti-spam challenge does not verify (no writes)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await submitContact({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(enquiryCreate).not.toHaveBeenCalled();
  });
});
