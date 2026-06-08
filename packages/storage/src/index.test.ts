import { describe, expect, it } from 'vitest';
import * as storage from './index.js';

describe('@estate/storage barrel', () => {
  it('exports the public API', () => {
    expect(typeof storage.StorageError).toBe('function');
    expect(typeof storage.isSafeKey).toBe('function');
    expect(typeof storage.LocalFilesystemBackend).toBe('function');
    expect(typeof storage.signObjectToken).toBe('function');
    expect(typeof storage.verifyObjectToken).toBe('function');
  });
});
