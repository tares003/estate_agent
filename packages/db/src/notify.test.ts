import { describe, expect, it } from 'vitest';
import { notify, type NotifyInput, type NotificationWriter } from './notify.js';

/** Fake NotificationWriter capturing the args passed to notificationLog.create(). */
function fakeWriter() {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const client: NotificationWriter = {
    notificationLog: {
      create: async (args) => {
        calls.push(args);
        return { id: 'notification-1' };
      },
    },
  };
  return { client, calls };
}

describe('notify', () => {
  it('queues an email notification with the subject.verb event and payload', async () => {
    const { client, calls } = fakeWriter();
    const payload = { propertyId: '00000000-0000-0000-0000-0000000000aa' };
    const input: NotifyInput = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      event: 'enquiry.received',
      channel: 'email',
      recipient: 'albert.aardvark@example.com',
      payload,
    };

    await notify(client, input);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.data).toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      event: 'enquiry.received',
      channel: 'email',
      recipient: 'albert.aardvark@example.com',
      status: 'queued',
      payload,
    });
  });

  it("always sets status 'queued' (dispatch is @estate/email's job)", async () => {
    const { client, calls } = fakeWriter();
    await notify(client, {
      event: 'repair.acknowledged',
      channel: 'sms',
      recipient: '+15555550100',
    });

    expect(calls[0]?.data.status).toBe('queued');
  });

  it('supports the in_app channel', async () => {
    const { client, calls } = fakeWriter();
    await notify(client, {
      tenantId: '00000000-0000-0000-0000-000000000001',
      event: 'viewing.confirmed',
      channel: 'in_app',
      recipient: 'agent:albert-aardvark',
    });

    expect(calls[0]?.data.channel).toBe('in_app');
  });

  it('maps absent optionals (tenantId / payload) to null', async () => {
    const { client, calls } = fakeWriter();
    await notify(client, {
      event: 'valuation.requested',
      channel: 'email',
      recipient: 'olive.okapi@example.com',
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      event: 'valuation.requested',
      channel: 'email',
      recipient: 'olive.okapi@example.com',
      status: 'queued',
      payload: null,
    });
  });

  it('treats explicit null tenantId / payload the same as absent', async () => {
    const { client, calls } = fakeWriter();
    await notify(client, {
      tenantId: null,
      event: 'feedback.submitted',
      channel: 'in_app',
      recipient: 'agent:albert-aardvark',
      payload: null,
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      event: 'feedback.submitted',
      channel: 'in_app',
      recipient: 'agent:albert-aardvark',
      status: 'queued',
      payload: null,
    });
  });

  it('resolves to void', async () => {
    const { client } = fakeWriter();
    const result = await notify(client, {
      event: 'enquiry.received',
      channel: 'email',
      recipient: 'albert.aardvark@example.com',
    });
    expect(result).toBeUndefined();
  });
});
