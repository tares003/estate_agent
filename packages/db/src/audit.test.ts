import { describe, expect, it } from 'vitest';
import { audit, type AuditInput, type AuditWriter } from './audit.js';

/** Fake AuditWriter capturing the args passed to auditLog.create(). */
function fakeWriter() {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const client: AuditWriter = {
    auditLog: {
      create: async (args) => {
        calls.push(args);
        return { id: 'audit-1' };
      },
    },
  };
  return { client, calls };
}

describe('audit', () => {
  it('writes a row with the subject.verb action and all required fields', async () => {
    const { client, calls } = fakeWriter();
    const input: AuditInput = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: 'agent:albert-aardvark',
      action: 'property.published',
      entity: 'property',
      entityId: '00000000-0000-0000-0000-0000000000aa',
    };

    await audit(client, input);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.data).toMatchObject({
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: 'agent:albert-aardvark',
      action: 'property.published',
      entity: 'property',
      entityId: '00000000-0000-0000-0000-0000000000aa',
    });
  });

  it('passes optional diff, ip and userAgent through unchanged', async () => {
    const { client, calls } = fakeWriter();
    const diff = { status: ['draft', 'published'] };
    await audit(client, {
      tenantId: '00000000-0000-0000-0000-000000000001',
      actor: 'agent:albert-aardvark',
      action: 'property.updated',
      entity: 'property',
      entityId: '00000000-0000-0000-0000-0000000000aa',
      diff,
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (deterministic)',
    });

    expect(calls[0]?.data).toMatchObject({
      diff,
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (deterministic)',
    });
  });

  it('maps absent optionals to null and omits no required key (operator action: tenantId null)', async () => {
    const { client, calls } = fakeWriter();
    await audit(client, {
      actor: 'operator:olive-okapi',
      action: 'tenant.suspended',
      entity: 'platform_tenant',
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      actor: 'operator:olive-okapi',
      action: 'tenant.suspended',
      entity: 'platform_tenant',
      entityId: null,
      diff: null,
      ip: null,
      userAgent: null,
    });
  });

  it('treats an explicit null tenantId / entityId the same as absent', async () => {
    const { client, calls } = fakeWriter();
    await audit(client, {
      tenantId: null,
      actor: 'operator:olive-okapi',
      action: 'tenant.deprovisioned',
      entity: 'platform_tenant',
      entityId: null,
      diff: null,
      ip: null,
      userAgent: null,
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      actor: 'operator:olive-okapi',
      action: 'tenant.deprovisioned',
      entity: 'platform_tenant',
      entityId: null,
      diff: null,
      ip: null,
      userAgent: null,
    });
  });

  it('resolves to void', async () => {
    const { client } = fakeWriter();
    const result = await audit(client, {
      actor: 'agent:albert-aardvark',
      action: 'property.viewed',
      entity: 'property',
    });
    expect(result).toBeUndefined();
  });
});
