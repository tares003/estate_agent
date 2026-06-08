import nodemailer from 'nodemailer';

import type { SmtpCredentials } from './credentials.js';
import type { MailTransport } from './mailer.js';

/**
 * Resolve the transport a {@link NodemailerMailer} should send through: the
 * injected one in tests, or a real nodemailer SMTP transport built from the
 * tenant's credentials in production.
 *
 * This is the connection glue — the `nodemailer.createTransport()` call cannot
 * be unit-tested without a live SMTP server — so this whole file is excluded
 * from coverage. The send mapping that consumes the transport is fully covered
 * via an injected fake in `mailer.test.ts`.
 */
export function resolveTransport(creds: SmtpCredentials, injected?: MailTransport): MailTransport {
  if (injected) return injected;
  return nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.pass },
  });
}
