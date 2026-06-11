import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  claimNotification,
  dispatchTenantNotifications,
  finalizeNotification,
  listQueuedNotifications,
  runDispatchTick,
  type NotificationQueueClient,
  type QueuedNotificationRow,
  type TenantRunner,
} from './notification-dispatcher.js';

const TENANT = '00000000-0000-0000-0000-000000000001';

function row(over: Partial<QueuedNotificationRow> = {}): QueuedNotificationRow {
  return {
    id: 'n1',
    event: 'repair_request.received',
    recipient: 'tess@example.com',
    payload: { reference: 'RPR-2026-00042' },
    ...over,
  };
}

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

function runnerFor(tx: Tx): TenantRunner {
  return async (fn) => fn(tx as unknown as NotificationQueueClient);
}

describe('listQueuedNotifications', () => {
  it('reads the oldest queued email rows up to the batch limit', async () => {
    const tx = makeTx();
    await listQueuedNotifications(tx as unknown as NotificationQueueClient, 10);
    expect(tx.notificationLog.findMany).toHaveBeenCalledWith({
      where: { status: 'queued', channel: 'email' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });
  });
});

describe('claimNotification', () => {
  it('claims atomically — only a still-queued row is claimed', async () => {
    const tx = makeTx();
    tx.notificationLog.updateMany.mockResolvedValue({ count: 1 });
    await expect(claimNotification(tx as unknown as NotificationQueueClient, 'n1')).resolves.toBe(
      true,
    );
    expect(tx.notificationLog.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', status: 'queued' },
      data: { status: 'processing' },
    });

    tx.notificationLog.updateMany.mockResolvedValue({ count: 0 });
    await expect(claimNotification(tx as unknown as NotificationQueueClient, 'n1')).resolves.toBe(
      false,
    );
  });
});

describe('finalizeNotification', () => {
  it('marks the row and writes the audit row in the same client (G4)', async () => {
    const tx = makeTx();
    await finalizeNotification(tx as unknown as NotificationQueueClient, {
      tenantId: TENANT,
      id: 'n1',
      status: 'sent',
    });
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'sent' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        actor: 'worker:email-send',
        action: 'notification.sent',
        entity: 'notification_log',
        entityId: 'n1',
      }),
    });
  });
});

describe('dispatchTenantNotifications', () => {
  let tx: Tx;
  const send = vi.fn();
  const mailer = { send };
  const render = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
    send.mockResolvedValue({ messageId: 'm1' });
    render.mockReturnValue({ subject: 'Hello', html: '<p>Hi</p>' });
  });

  it('sends a claimed row and finalizes it as sent', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);

    const result = await dispatchTenantNotifications({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      mailer,
      render,
    });

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(send).toHaveBeenCalledWith({
      to: 'tess@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'sent' },
    });
  });

  it('is idempotent under replay — an already-claimed row is skipped, not re-sent', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);
    tx.notificationLog.updateMany.mockResolvedValue({ count: 0 }); // someone else claimed it

    const result = await dispatchTenantNotifications({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      mailer,
      render,
    });

    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(tx.notificationLog.update).not.toHaveBeenCalled();
  });

  it('fails a row whose event has no template, without sending', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row({ event: 'mystery.event' })]);
    render.mockReturnValue(null);

    const result = await dispatchTenantNotifications({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      mailer,
      render,
    });

    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'failed' },
    });
  });

  it('fails the batch rows when the tenant has no SMTP configured (no mailer)', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row()]);

    const result = await dispatchTenantNotifications({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      mailer: null,
      render,
    });

    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('marks a row failed when the SMTP send throws, and keeps dispatching', async () => {
    tx.notificationLog.findMany.mockResolvedValue([row(), row({ id: 'n2' })]);
    send.mockRejectedValueOnce(new Error('smtp down')).mockResolvedValueOnce({ messageId: 'm2' });

    const result = await dispatchTenantNotifications({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      mailer,
      render,
    });

    expect(result).toEqual({ sent: 1, failed: 1, skipped: 0 });
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { status: 'failed' },
    });
    expect(tx.notificationLog.update).toHaveBeenCalledWith({
      where: { id: 'n2' },
      data: { status: 'sent' },
    });
  });
});

describe('runDispatchTick', () => {
  it('dispatches every active tenant inside its own tenant scope', async () => {
    const txA = makeTx();
    const txB = makeTx();
    txA.notificationLog.findMany.mockResolvedValue([row()]);
    txB.notificationLog.findMany.mockResolvedValue([]);

    const runners: Record<string, Tx> = { 'tenant-a': txA, 'tenant-b': txB };
    const mailerA = { send: vi.fn().mockResolvedValue({ messageId: 'm1' }) };
    const resolveMailer = vi
      .fn()
      .mockImplementation(async (tenantId: string) => (tenantId === 'tenant-a' ? mailerA : null));

    const result = await runDispatchTick({
      listActiveTenants: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      runTenantFor: (tenantId) => runnerFor(runners[tenantId]!),
      resolveMailer,
      render: () => ({ subject: 's', html: 'h' }),
    });

    expect(result).toEqual({ tenants: 2, sent: 1, failed: 0, skipped: 0 });
    expect(mailerA.send).toHaveBeenCalledTimes(1);
    expect(resolveMailer).toHaveBeenCalledWith('tenant-a');
    expect(resolveMailer).toHaveBeenCalledWith('tenant-b');
  });
});
