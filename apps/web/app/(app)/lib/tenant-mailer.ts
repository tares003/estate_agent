import config from '@payload-config';
import { NodemailerMailer, decryptSecret, type Mailer, type SmtpCredentials } from '@estate/email';
import { getPayload } from 'payload';

import { emailEncryptionKey } from '../../../payload/fields/secret-field.js';

// EPIC-D / FR-D-8 send path: resolve a per-tenant Mailer from the encrypted
// email_settings (B29). Reads the raw ciphertext via `context: { decryptSecrets }`
// (bypassing the read-mask), decrypts the password server-side, and constructs the
// NodemailerMailer. Glue (Payload Local API + Prisma-free crypto) — verified by
// build + the email-package unit tests; the testable crypto/field logic lives in
// @estate/email + payload/fields/secret-field.ts.

/** Resolve the tenant's configured Mailer, or null when SMTP is not configured. */
export async function getTenantMailer(tenantId: string): Promise<Mailer | null> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: 'email_settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    pagination: false,
    overrideAccess: true,
    context: { decryptSecrets: true },
  });

  const doc = result.docs[0];
  if (!doc || !doc.pass) {
    return null;
  }

  const credentials: SmtpCredentials = {
    host: String(doc.host),
    port: Number(doc.port),
    secure: Boolean(doc.secure),
    user: String(doc.user),
    pass: decryptSecret(String(doc.pass), emailEncryptionKey()),
    fromAddress: String(doc.fromAddress),
    ...(doc.replyTo ? { replyTo: String(doc.replyTo) } : {}),
  };
  return new NodemailerMailer(credentials);
}
