import { describe, expect, it, vi } from 'vitest';

import { TwilioSmsBackend, type TwilioCredentials, type FetchLike } from './twilio.js';

const CREDS: TwilioCredentials = {
  accountSid: 'ACxxxxxxxx',
  authToken: 'tok-secret',
  fromNumber: '+15005550006',
};

function okResponse(sid = 'SM123'): Response {
  return new Response(JSON.stringify({ sid }), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  });
}

describe('TwilioSmsBackend.send', () => {
  it('POSTs the message to the account Messages endpoint with basic auth', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(okResponse('SMabc'));
    const backend = new TwilioSmsBackend(CREDS, fetchMock);

    const result = await backend.send('+447700900000', 'Your emergency repair RPR-1 is logged.');

    expect(result).toEqual({ sid: 'SMabc' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxx/Messages.json');
    expect(init?.method).toBe('POST');

    const auth = (init?.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from('ACxxxxxxxx:tok-secret').toString('base64')}`);

    const body = new URLSearchParams(String(init?.body));
    expect(body.get('To')).toBe('+447700900000');
    expect(body.get('From')).toBe('+15005550006');
    expect(body.get('Body')).toBe('Your emergency repair RPR-1 is logged.');
  });

  it('throws when Twilio responds with a non-2xx status (so the caller can fail the row)', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'unverified number' }), { status: 400 }),
    );
    const backend = new TwilioSmsBackend(CREDS, fetchMock);

    await expect(backend.send('+447700900000', 'hi')).rejects.toThrow();
  });
});
