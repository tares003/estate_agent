import { NodemailerMailer, decryptSecret, type Mailer, type SmtpCredentials } from '@estate/email';

// EPIC-U email-send — the production mailer binding. Resolves a tenant's Mailer
// from the `email_settings` Payload collection (B29: per-tenant SMTP, password
// AES-256-GCM-encrypted at rest by secret-field; CLAUDE.md §9 — never plaintext).
//
// The worker process does not mount Payload, so this reads the collection's
// Postgres table directly. COUPLING NOTE: the table/column names follow Payload's
// postgres adapter naming for the `email_settings` slug (snake_case columns,
// `tenant_id` for the tenant relationship); a collection rename must update this
// query. Connection glue (live DB + live key + nodemailer) — excluded from unit
// coverage like @estate/email's transport.ts; the dispatch logic it feeds is
// fully covered via injected fakes in notification-dispatcher.test.ts.

interface EmailSettingsRow {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string | null;
  from_address: string;
  reply_to: string | null;
}

/** The raw-query surface the resolver needs (a PrismaClient satisfies it). */
export interface RawQueryClient {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
}

/** The 32-byte AES key from env (base64), as secret-field encrypts with. Fails closed. */
function emailEncryptionKey(): Buffer {
  const raw = process.env['EMAIL_ENCRYPTION_KEY'];
  if (!raw) {
    throw new Error('EMAIL_ENCRYPTION_KEY is not set');
  }
  return Buffer.from(raw, 'base64');
}

/** Resolve the tenant's configured Mailer, or null when SMTP is not configured. */
export async function resolveTenantMailer(
  db: RawQueryClient,
  tenantId: string,
): Promise<Mailer | null> {
  const rows = await db.$queryRawUnsafe<EmailSettingsRow[]>(
    'SELECT host, port, secure, "user", pass, from_address, reply_to FROM email_settings WHERE tenant_id = $1::uuid LIMIT 1',
    tenantId,
  );
  const row = rows[0];
  if (!row || !row.pass) {
    return null;
  }

  const credentials: SmtpCredentials = {
    host: row.host,
    port: Number(row.port),
    secure: Boolean(row.secure),
    user: row.user,
    pass: decryptSecret(row.pass, emailEncryptionKey()),
    fromAddress: row.from_address,
    ...(row.reply_to ? { replyTo: row.reply_to } : {}),
  };
  return new NodemailerMailer(credentials);
}
