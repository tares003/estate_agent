import { afterEach, describe, expect, it } from 'vitest';

import { getStorageBackend, storageSigningSecret } from './storage.js';

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
