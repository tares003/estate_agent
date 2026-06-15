import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dispatchTenantSms,
  listQueuedSms,
  renderSms,
  runSmsTick,
  type SmsQueueClient,
  type SmsTenantRunner,
} from './sms-dispatcher.js';

const TENANT = '00000000-0000-0000-0000-000000000001';

function makeTx() {
  return {
    notificationLog: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}
type Tx = ReturnType<typeof makeTx>;
function runnerFor(tx: Tx): SmsTenantRunner {
  return async (fn) => fn(tx as unknown as SmsQueueClient);
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    event: 'repair_request.emergency',
    recipient: '+447700900000',
    payload: { reference: 'RPR-2026-00042' },
    ...over,
  };
}

describe('renderSms', () => {
  it('renders the emergency-repair text with the ticket reference', () => {
    const text = renderSms('repair_request.emergency', { reference: 'RPR-2026-00042' });
    expect(text).not.toBeNull();
    expect(text).toContain('RPR-2026-00042');
  });

  it('returns null for an event with no SMS template', () => {
    expect(renderSms('mystery.event', {})).toBeNull();
  });
});

describe('listQueuedSms', () => {
  it('reads the oldest queued SMS rows', async () => {
    const tx = makeTx();
    await listQueuedSms(tx as unknown as SmsQueueClient, 10);
    expect(tx.notificationLog.findMany).toHaveBeenCalledWith({
      where: { status: 'queued', channel: 'sms' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  });
});

describe('dispatchTenantSms', () => {
  let tx: Tx;
  const send = vi.fn();
  const backend = { send };

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
    send.mockResolvedValue({ sid: 'SM1' });
  });

  it('sends a claimed row and finalizes it sent + audits (G4)', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);

    const result = await dispatchTenantSms({ tenantId: TENANT, runTenant: runnerFor(tx), backend });

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledWith('+447700900000', expect.stringContaining('RPR-2026-00042'));
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'sent' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actor: 'worker:sms-send', action: 'notification.sent' }),
    });
  });

  it('is idempotent — an already-claimed row is skipped, not re-sent', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);
    tx.notificationLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await dispatchTenantSms({ tenantId: TENANT, runTenant: runnerFor(tx), backend });
    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it('fails a row when no SMS backend is configured (Twilio not set up)', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);
    const result = await dispatchTenantSms({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      backend: null,
    });
    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('fails a row with no template and one whose send throws, without blocking the batch', async () => {
    tx.notificationLog.findMany.mockResolvedValue([
      row({ id: 'a', event: 'mystery.x' }),
      row({ id: 'b' }),
    ]);
    send.mockRejectedValueOnce(new Error('twilio down'));
    const result = await dispatchTenantSms({ tenantId: TENANT, runTenant: runnerFor(tx), backend });
    // both fail — 'a' has no template, 'b' throws on send — and neither blocks the other
    expect(result.failed).toBe(2);
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { status: 'failed' },
    });
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { status: 'failed' },
    });
  });
});

describe('runSmsTick', () => {
  it('dispatches every active tenant in its own scope', async () => {
    const txA = makeTx();
    txA.notificationLog.findMany.mockResolvedValue([row()]);
    const send = vi.fn().mockResolvedValue({ sid: 'SM1' });

    const result = await runSmsTick({
      listActiveTenants: async () => [{ id: 'tenant-a' }],
      runTenantFor: () => runnerFor(txA),
      resolveBackend: () => ({ send }),
    });
    expect(result).toEqual({ tenants: 1, sent: 1, failed: 0, skipped: 0 });
  });
});
