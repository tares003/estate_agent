import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (assignmentRuleSchema) drives the rules; the data layer,
// request context, and staff-session seam are doubled so the FR-H-4 create action
// is exercised in isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const aggregate = vi.fn();
const create = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ assignmentRule: { aggregate, create } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createAssignmentRule } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const RULE = '99999999-9999-9999-9999-999999999999';
const AGENT = '11111111-1111-1111-1111-111111111111';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** A valid rule payload (the editor serialises conditions/assignment as JSON). */
function validForm(): FormData {
  return form({
    name: 'New buyer enquiries to agent A',
    conditions: JSON.stringify([
      { field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' },
    ]),
    assignment: JSON.stringify({ targetType: 'agent', targetId: AGENT }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  requireStaffPermission.mockResolvedValue(undefined);
  aggregate.mockResolvedValue({ _max: { position: 2 } });
  create.mockResolvedValue({ id: RULE });
});

describe('createAssignmentRule (FR-H-4)', () => {
  it('appends the rule at the bottom of the chain and audits it (G4)', async () => {
    const result = await createAssignmentRule({ ok: false }, validForm());

    expect(result).toEqual({ ok: true, ruleId: RULE });
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.write');
    // next position is max(existing) + 1 — a new rule loses to the existing ones
    // until reordered (first-match-wins is order-sensitive).
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        name: 'New buyer enquiries to agent A',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
        assignment: { targetType: 'agent', targetId: AGENT },
        position: 3,
      },
    });
    expect(audit).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      actor: 'agent:dev-staff',
      action: 'assignment_rule.created',
      entity: 'assignment_rule',
      entityId: RULE,
      diff: {
        name: 'New buyer enquiries to agent A',
        conditions: [{ field: 'lead_type', operator: 'equals', value: 'buyer_enquiry' }],
        assignment: { targetType: 'agent', targetId: AGENT },
        position: 3,
      },
      ip: '203.0.113.7',
    });
  });

  it('positions the first rule at 0 when none exist yet', async () => {
    aggregate.mockResolvedValue({ _max: { position: null } });
    const result = await createAssignmentRule({ ok: false }, validForm());

    expect(result.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: 0 }) }),
    );
  });

  it('is RBAC-gated — denies without enquiry.write, before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await createAssignmentRule({ ok: false }, validForm());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an empty rule (no conditions) before any write', async () => {
    const result = await createAssignmentRule(
      { ok: false },
      form({
        name: 'Catch all',
        conditions: JSON.stringify([]),
        assignment: JSON.stringify({ targetType: 'agent', targetId: AGENT }),
      }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid assignment target before any write', async () => {
    const result = await createAssignmentRule(
      { ok: false },
      form({
        name: 'Bad target',
        conditions: JSON.stringify([{ field: 'status', operator: 'equals', value: 'new' }]),
        assignment: JSON.stringify({ targetType: 'agent', targetId: 'not-a-uuid' }),
      }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON in the conditions field without throwing', async () => {
    const result = await createAssignmentRule(
      { ok: false },
      form({
        name: 'Broken',
        conditions: '{not json',
        assignment: JSON.stringify({ targetType: 'agent', targetId: AGENT }),
      }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
