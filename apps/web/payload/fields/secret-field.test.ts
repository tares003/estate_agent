// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encryptSecret } from '@estate/email';

import {
  SECRET_MASK,
  emailEncryptionKey,
  maskSecretRead,
  resolveSecretWrite,
  secretField,
} from './secret-field.js';

// A reusable Payload "secret" field: encrypts the value at rest on write, masks
// it on read, and never re-encrypts an unchanged (masked) resubmission. Used for
// the tenant SMTP password (B29). The pure write/read logic is tested directly;
// the factory's hooks are exercised with the encryption key set.

const key = Buffer.alloc(32, 5);
const enc = (value: string): string => encryptSecret(value, key);

describe('resolveSecretWrite', () => {
  it('encrypts brand-new plaintext into an envelope', () => {
    const out = resolveSecretWrite('hunter2', null, enc);
    expect(out).not.toBe('hunter2');
    expect(out).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
  });

  it('keeps the existing ciphertext when the mask is resubmitted (no change)', () => {
    expect(resolveSecretWrite(SECRET_MASK, 'existing-envelope', enc)).toBe('existing-envelope');
  });

  it('keeps the existing value when the input is empty/undefined', () => {
    expect(resolveSecretWrite('', 'existing-envelope', enc)).toBe('existing-envelope');
    expect(resolveSecretWrite(undefined, 'existing-envelope', enc)).toBe('existing-envelope');
  });

  it('returns null when cleared and nothing was stored', () => {
    expect(resolveSecretWrite('', null, enc)).toBeNull();
  });

  it('stores an already-encrypted envelope as-is (never double-encrypts)', () => {
    const env = enc('x');
    expect(resolveSecretWrite(env, 'old', enc)).toBe(env);
  });
});

describe('maskSecretRead', () => {
  it('masks a stored secret', () => {
    expect(maskSecretRead('ciphertext')).toBe(SECRET_MASK);
  });

  it('returns null for empty/missing values', () => {
    expect(maskSecretRead('')).toBeNull();
    expect(maskSecretRead(null)).toBeNull();
    expect(maskSecretRead(undefined)).toBeNull();
  });
});

describe('emailEncryptionKey', () => {
  const original = process.env['EMAIL_ENCRYPTION_KEY'];
  afterAll(() => {
    if (original === undefined) {
      delete process.env['EMAIL_ENCRYPTION_KEY'];
    } else {
      process.env['EMAIL_ENCRYPTION_KEY'] = original;
    }
  });

  it('decodes the base64 env key to a 32-byte Buffer', () => {
    process.env['EMAIL_ENCRYPTION_KEY'] = Buffer.alloc(32, 1).toString('base64');
    expect(emailEncryptionKey()).toHaveLength(32);
  });

  it('fails closed when the env key is unset', () => {
    delete process.env['EMAIL_ENCRYPTION_KEY'];
    expect(() => emailEncryptionKey()).toThrow(/EMAIL_ENCRYPTION_KEY/);
  });
});

describe('secretField factory', () => {
  const original = process.env['EMAIL_ENCRYPTION_KEY'];
  beforeAll(() => {
    process.env['EMAIL_ENCRYPTION_KEY'] = Buffer.alloc(32, 3).toString('base64');
  });
  afterAll(() => {
    if (original === undefined) {
      delete process.env['EMAIL_ENCRYPTION_KEY'];
    } else {
      process.env['EMAIL_ENCRYPTION_KEY'] = original;
    }
  });

  type HookField = {
    type: string;
    hooks: {
      beforeChange: ((args: {
        value: unknown;
        originalDoc?: Record<string, unknown>;
      }) => unknown)[];
      afterRead: ((args: { value: unknown; context?: Record<string, unknown> }) => unknown)[];
    };
  };

  it('builds a text field that encrypts on write and masks on read', () => {
    const field = secretField('pass') as unknown as HookField;
    expect(field.type).toBe('text');
    const stored = field.hooks.beforeChange[0]!({ value: 'plain', originalDoc: {} });
    expect(stored).not.toBe('plain');
    expect(field.hooks.afterRead[0]!({ value: stored, context: {} })).toBe(SECRET_MASK);
  });

  it('exposes the raw ciphertext to a server resolver via context.decryptSecrets', () => {
    const field = secretField('pass') as unknown as HookField;
    const stored = field.hooks.beforeChange[0]!({ value: 'plain', originalDoc: {} });
    const raw = field.hooks.afterRead[0]!({ value: stored, context: { decryptSecrets: true } });
    expect(raw).toBe(stored);
  });
});
