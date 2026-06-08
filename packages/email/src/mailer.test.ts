import { describe, expect, it, vi } from 'vitest';

import type { SmtpCredentials } from './credentials.js';
import { NodemailerMailer, type MailTransport, type OutboundMessage } from './mailer.js';

const CREDS: SmtpCredentials = {
  host: 'smtp.example.co.uk',
  port: 587,
  secure: false,
  user: 'agent@example.co.uk',
  pass: 'secret',
  fromAddress: 'lettings@example.co.uk',
  replyTo: 'no-reply@example.co.uk',
};

const MESSAGE: OutboundMessage = {
  to: 'tenant@example.com',
  subject: 'Your viewing is confirmed',
  html: '<p>Hello</p>',
  text: 'Hello',
};

/** A fake transport capturing the last sendMail call — no real SMTP. */
function makeTransport(messageId = 'msg-001'): MailTransport & {
  sendMail: ReturnType<typeof vi.fn>;
} {
  return {
    sendMail: vi.fn(async () => ({ messageId })),
  };
}

describe('NodemailerMailer', () => {
  it('maps OutboundMessage to the transport with the right envelope (positive)', async () => {
    const transport = makeTransport('msg-123');
    const mailer = new NodemailerMailer(CREDS, transport);

    const result = await mailer.send(MESSAGE);

    expect(result.messageId).toBe('msg-123');
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: CREDS.fromAddress,
      replyTo: CREDS.replyTo,
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      text: MESSAGE.text,
    });
  });

  it('omits replyTo and text when the credentials/message do not set them (edge)', async () => {
    const credsNoReply: SmtpCredentials = {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'agent@example.com',
      pass: 'secret',
      fromAddress: 'sales@example.com',
    };
    const transport = makeTransport();
    const mailer = new NodemailerMailer(credsNoReply, transport);

    await mailer.send({
      to: 'vendor@example.com',
      subject: 'Valuation booked',
      html: '<p>Body</p>',
    });

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: credsNoReply.fromAddress,
      to: 'vendor@example.com',
      subject: 'Valuation booked',
      html: '<p>Body</p>',
    });
    const opts = transport.sendMail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect('replyTo' in opts).toBe(false);
    expect('text' in opts).toBe(false);
  });

  it('propagates a transport failure to the caller (negative)', async () => {
    const transport: MailTransport = {
      sendMail: vi.fn(async () => {
        throw new Error('SMTP 535 auth failed');
      }),
    };
    const mailer = new NodemailerMailer(CREDS, transport);

    await expect(mailer.send(MESSAGE)).rejects.toThrow('SMTP 535 auth failed');
  });
});
