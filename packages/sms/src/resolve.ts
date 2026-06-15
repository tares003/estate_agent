import { TwilioSmsBackend } from './twilio.js';
import type { SmsBackend } from './backend.js';

// The operator's SMS backend, resolved from env at install time (CLAUDE.md §9 —
// one Twilio account at the operator level). Fail-OPEN-to-null, NOT fail-closed-
// to-throw: SMS is a best-effort alert channel, so when no credentials are
// configured the resolver returns null and callers simply skip SMS (the email
// path and the DB record are unaffected). Connection glue (env + real `fetch`),
// excluded from coverage; the request mapping is covered in twilio.test.ts.

/** The configured operator SMS backend, or null when Twilio is not configured. */
export function resolveSmsBackend(): SmsBackend | null {
  const accountSid = process.env['TWILIO_ACCOUNT_SID'];
  const authToken = process.env['TWILIO_AUTH_TOKEN'];
  const fromNumber = process.env['TWILIO_FROM_NUMBER'];
  if (!accountSid || !authToken || !fromNumber) {
    return null;
  }
  return new TwilioSmsBackend({ accountSid, authToken, fromNumber }, (url, init) =>
    fetch(url, init),
  );
}
