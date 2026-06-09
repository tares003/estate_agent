import type { Field } from 'payload';

import { encryptSecret, isSecretEnvelope } from '@estate/email';

// A reusable Payload "secret" field (B29): the value is AES-256-GCM encrypted at
// rest on write and masked on read, so plaintext is never persisted or returned
// to the admin. A server-side resolver reads the raw ciphertext by passing
// `context: { decryptSecrets: true }` to the Local API. Used for the tenant SMTP
// password. The pure write/read logic is unit-tested; the factory wires it to the
// env key + Payload's hook shape.

/** What the admin sees in place of a stored secret. */
export const SECRET_MASK = '••••••••';

/**
 * Decide what to STORE for a secret field. New plaintext → encrypted; an
 * unchanged resubmission (the mask) or an empty value → keep the existing stored
 * value (never wipe/re-encrypt); an already-encrypted envelope → stored as-is.
 */
export function resolveSecretWrite(
  incoming: unknown,
  existing: string | null | undefined,
  encrypt: (plaintext: string) => string,
): string | null {
  if (typeof incoming !== 'string' || incoming === '' || incoming === SECRET_MASK) {
    return existing ?? null;
  }
  if (isSecretEnvelope(incoming)) {
    return incoming;
  }
  return encrypt(incoming);
}

/** Mask a stored secret for normal reads (ciphertext/plaintext never leaves). */
export function maskSecretRead(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? SECRET_MASK : null;
}

/** The 32-byte AES key from env (base64-encoded). Shared by the field hooks and
 * the server-side mailer resolver. Fails closed when unset. */
export function emailEncryptionKey(): Buffer {
  const raw = process.env['EMAIL_ENCRYPTION_KEY'];
  if (!raw) {
    throw new Error('EMAIL_ENCRYPTION_KEY is not set');
  }
  return Buffer.from(raw, 'base64');
}

/** A Payload text field that encrypts its value at rest and masks it on read. */
export function secretField(name: string, description?: string): Field {
  return {
    name,
    type: 'text',
    ...(description !== undefined ? { admin: { description } } : {}),
    hooks: {
      beforeChange: [
        ({ value, originalDoc }) =>
          resolveSecretWrite(
            value,
            (originalDoc as Record<string, unknown> | undefined)?.[name] as string | undefined,
            (plaintext) => encryptSecret(plaintext, emailEncryptionKey()),
          ),
      ],
      afterRead: [
        ({ value, context }) =>
          (context as Record<string, unknown> | undefined)?.['decryptSecrets']
            ? value
            : maskSecretRead(value),
      ],
    },
  };
}
