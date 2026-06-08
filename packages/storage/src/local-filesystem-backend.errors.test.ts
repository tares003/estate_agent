import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageError } from './backend.js';

// Mock the filesystem so we can drive the non-ENOENT error branches deterministically.
const readFile = vi.fn();
const stat = vi.fn();
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  rm: vi.fn(async () => undefined),
  readFile: (...args: unknown[]) => readFile(...args),
  stat: (...args: unknown[]) => stat(...args),
}));

// Import after the mock is registered.
const { LocalFilesystemBackend } = await import('./local-filesystem-backend.js');

describe('LocalFilesystemBackend — non-ENOENT error handling', () => {
  let backend: InstanceType<typeof LocalFilesystemBackend>;

  beforeEach(() => {
    backend = new LocalFilesystemBackend('/srv/storage-root');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('get() wraps a generic (EACCES) read error as StorageError', async () => {
    readFile.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(backend.get('blocked.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('get() wraps an error whose code is not a string', async () => {
    readFile.mockRejectedValueOnce(Object.assign(new Error('weird'), { code: 123 }));
    await expect(backend.get('weird.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('get() wraps a thrown non-object (string) value', async () => {
    readFile.mockRejectedValueOnce('boom');
    await expect(backend.get('stringy.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('exists() rethrows a generic (EACCES) stat error as StorageError', async () => {
    stat.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }));
    await expect(backend.exists('blocked.txt')).rejects.toBeInstanceOf(StorageError);
  });
});
