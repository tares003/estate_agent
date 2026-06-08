import type { SmtpCredentials } from './credentials.js';
import { resolveTransport } from './transport.js';

/** An application-level message to send, independent of the SMTP envelope. */
export interface OutboundMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** The SMTP envelope passed to the underlying transport. */
export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  text?: string;
}

/**
 * The minimal slice of nodemailer's `Transporter` this package depends on. A
 * real `nodemailer.Transporter` satisfies it; tests inject a fake so no real
 * SMTP connection is made.
 */
export interface MailTransport {
  sendMail(opts: SendMailOptions): Promise<{ messageId: string }>;
}

/** Sends an {@link OutboundMessage}, returning the transport's message id. */
export interface Mailer {
  send(message: OutboundMessage): Promise<{ messageId: string }>;
}

/**
 * A {@link Mailer} backed by per-tenant SMTP via nodemailer. Constructed from a
 * tenant's {@link SmtpCredentials}; the underlying {@link MailTransport} is
 * injectable so tests use a fake (no real SMTP). `send()` maps an
 * {@link OutboundMessage} onto the SMTP envelope, sourcing `from` and `replyTo`
 * from the credentials.
 */
export class NodemailerMailer implements Mailer {
  private readonly credentials: SmtpCredentials;
  private readonly transport: MailTransport;

  constructor(credentials: SmtpCredentials, transport?: MailTransport) {
    this.credentials = credentials;
    this.transport = resolveTransport(credentials, transport);
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    const opts: SendMailOptions = {
      from: this.credentials.fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
    };
    if (this.credentials.replyTo !== undefined) {
      opts.replyTo = this.credentials.replyTo;
    }
    if (message.text !== undefined) {
      opts.text = message.text;
    }
    return this.transport.sendMail(opts);
  }
}
