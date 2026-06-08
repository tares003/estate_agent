import { describe, expect, it } from 'vitest';
import { recordConsent, type ConsentInput, type ConsentWriter } from './consent.js';

/** Fake ConsentWriter capturing the args passed to consentLog.create(). */
function fakeWriter() {
  const calls: Array<{ data: Record<string, unknown> }> = [];
  const client: ConsentWriter = {
    consentLog: {
      create: async (args) => {
        calls.push(args);
        return { id: 'consent-1' };
      },
    },
  };
  return { client, calls };
}

describe('recordConsent', () => {
  it('writes a consent row with scope, subject and consentText', async () => {
    const { client, calls } = fakeWriter();
    const input: ConsentInput = {
      tenantId: '00000000-0000-0000-0000-000000000001',
      scope: 'enquiry_form',
      subject: 'albert.aardvark@example.com',
      consentText: 'I agree to be contacted about this enquiry.',
      ipAddress: '203.0.113.7',
    };

    await recordConsent(client, input);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.data).toEqual({
      tenantId: '00000000-0000-0000-0000-000000000001',
      scope: 'enquiry_form',
      subject: 'albert.aardvark@example.com',
      consentText: 'I agree to be contacted about this enquiry.',
      ipAddress: '203.0.113.7',
    });
  });

  it('maps absent optionals (tenantId / ipAddress) to null', async () => {
    const { client, calls } = fakeWriter();
    await recordConsent(client, {
      scope: 'valuation_request',
      subject: 'olive.okapi@example.com',
      consentText: 'I consent to the privacy policy.',
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      scope: 'valuation_request',
      subject: 'olive.okapi@example.com',
      consentText: 'I consent to the privacy policy.',
      ipAddress: null,
    });
  });

  it('treats explicit null tenantId / ipAddress the same as absent', async () => {
    const { client, calls } = fakeWriter();
    await recordConsent(client, {
      tenantId: null,
      scope: 'viewing_booking',
      subject: 'beatrice.beaver@example.com',
      consentText: 'I consent.',
      ipAddress: null,
    });

    expect(calls[0]?.data).toEqual({
      tenantId: null,
      scope: 'viewing_booking',
      subject: 'beatrice.beaver@example.com',
      consentText: 'I consent.',
      ipAddress: null,
    });
  });

  it('resolves to void', async () => {
    const { client } = fakeWriter();
    const result = await recordConsent(client, {
      scope: 'enquiry_form',
      subject: 'albert.aardvark@example.com',
      consentText: 'I agree.',
    });
    expect(result).toBeUndefined();
  });
});
