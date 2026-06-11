import { afterEach, describe, expect, it } from 'vitest';
import { verifyObjectToken } from '@estate/storage';

import { getStorageBackend, signedObjectPath, storageSigningSecret } from './storage.js';

const ENV_KEYS = ['STORAGE_SIGNING_SECRET', 'STORAGE_DIR'] as const;
const saved: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) saved[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('storageSigningSecret', () => {
  it('fails closed when unset and returns the configured secret', () => {
    delete process.env['STORAGE_SIGNING_SECRET'];
    expect(() => storageSigningSecret()).toThrow(/STORAGE_SIGNING_SECRET/);
    process.env['STORAGE_SIGNING_SECRET'] = 's3cret';
    expect(storageSigningSecret()).toBe('s3cret');
  });
});

describe('signedObjectPath', () => {
  it('mints an app-relative serving path whose token attests the key', () => {
    process.env['STORAGE_SIGNING_SECRET'] = 's3cret';
    const expires = Date.now() + 60_000;
    const path = signedObjectPath('tenants/t/properties/p/a.jpg', expires);

    expect(path.startsWith('/api/storage/object?token=')).toBe(true);
    const token = decodeURIComponent(path.split('token=')[1]!);
    expect(verifyObjectToken(token, 's3cret', Date.now())?.key).toBe(
      'tenants/t/properties/p/a.jpg',
    );
  });
});

describe('getStorageBackend', () => {
  it('fails closed when STORAGE_DIR is unset and builds a backend when set', () => {
    delete process.env['STORAGE_DIR'];
    expect(() => getStorageBackend()).toThrow(/STORAGE_DIR/);
    process.env['STORAGE_DIR'] = 'C:/tmp/estate-storage-test';
    const backend = getStorageBackend();
    expect(typeof backend.put).toBe('function');
    expect(typeof backend.get).toBe('function');
  });
});
