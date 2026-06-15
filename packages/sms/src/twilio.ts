import { SmsError, type SmsBackend } from './backend.js';

// Twilio SMS backend (CLAUDE.md §9 — the committed SMS provider; no self-hosted
// alternative, carrier agreements required). Sends via Twilio's REST API over
// `fetch` (no SDK dependency), authenticated with HTTP basic auth (account SID +
// auth token). The `fetch` transport is injected so the request mapping is
// unit-tested with a fake; the real binding is wired in resolve.ts.

/** Operator Twilio credentials (from env at install time; never per-tenant). */
export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  /** The Twilio-verified sending number, E.164. */
  fromNumber: string;
}

/** The slice of `fetch` the backend uses (injected for tests). */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class TwilioSmsBackend implements SmsBackend {
  constructor(
    private readonly creds: TwilioCredentials,
    private readonly fetchImpl: FetchLike,
  ) {}

  async send(to: string, body: string): Promise<{ sid: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.creds.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.creds.accountSid}:${this.creds.authToken}`).toString('base64');
    const form = new URLSearchParams({ To: to, From: this.creds.fromNumber, Body: body });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
    } catch (cause) {
      throw new SmsError('Twilio request failed', { cause });
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SmsError(`Twilio rejected the message (HTTP ${response.status})`);
    }
    const json = (await response.json()) as { sid?: string };
    return { sid: json.sid ?? '' };
  }
}
