import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageError } from './backend.js';
import { LocalFilesystemBackend } from './local-filesystem-backend.js';

describe('LocalFilesystemBackend', () => {
  let root: string;
  let backend: LocalFilesystemBackend;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'estate-storage-'));
    backend = new LocalFilesystemBackend(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips put -> get -> exists -> delete', async () => {
    const key = 'property/aa/photo.jpg';
    const data = Buffer.from('deterministic-bytes');

    await backend.put(key, data);
    expect(await backend.exists(key)).toBe(true);

    const got = await backend.get(key);
    expect(got).toBeInstanceOf(Buffer);
    expect(got.equals(data)).toBe(true);

    await backend.delete(key);
    expect(await backend.exists(key)).toBe(false);
  });

  it('creates intermediate directories for nested keys', async () => {
    const key = 'a/b/c/deep.bin';
    await backend.put(key, Buffer.from([1, 2, 3]));
    expect(existsSync(join(root, 'a', 'b', 'c', 'deep.bin'))).toBe(true);
  });

  it('accepts a Uint8Array payload and reads it back as the same bytes', async () => {
    const key = 'raw.bin';
    const payload = new Uint8Array([9, 8, 7, 6]);
    await backend.put(key, payload);
    const got = await backend.get(key);
    expect(Uint8Array.from(got)).toEqual(payload);
  });

  it('overwrites an existing key on a second put', async () => {
    const key = 'doc.txt';
    await backend.put(key, Buffer.from('first'));
    await backend.put(key, Buffer.from('second'));
    expect((await backend.get(key)).toString()).toBe('second');
  });

  it('exists() returns false for an absent key without throwing', async () => {
    expect(await backend.exists('never/written.txt')).toBe(false);
  });

  it('get() of a missing key throws StorageError', async () => {
    await expect(backend.get('missing.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('delete() of an absent key is idempotent (no throw)', async () => {
    await expect(backend.delete('absent.txt')).resolves.toBeUndefined();
  });

  it('put() rejects a traversal key and writes nothing outside the root', async () => {
    await expect(backend.put('../escape.txt', Buffer.from('x'))).rejects.toBeInstanceOf(
      StorageError,
    );
    // The sibling of root must not have been created.
    const escaped = join(root, '..', 'escape.txt');
    expect(existsSync(escaped)).toBe(false);
  });

  it('get() rejects a traversal key', async () => {
    await expect(backend.get('a/../../etc/passwd')).rejects.toBeInstanceOf(StorageError);
  });

  it('exists() rejects a traversal key', async () => {
    await expect(backend.exists('../escape.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('delete() rejects a traversal key', async () => {
    await expect(backend.delete('../escape.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('rejects an absolute key on put', async () => {
    await expect(backend.put('/etc/passwd', Buffer.from('x'))).rejects.toBeInstanceOf(StorageError);
  });

  it('does not let an existing readable file be read through a missing-permission path', async () => {
    // A genuinely missing nested key surfaces as StorageError, not a raw ENOENT.
    await backend.put('present.txt', Buffer.from('here'));
    await expect(backend.get('present.txt/child.txt')).rejects.toBeInstanceOf(StorageError);
  });

  it('writes the bytes verbatim to the resolved path inside the root', async () => {
    await backend.put('verbatim.txt', Buffer.from('exact'));
    const onDisk = await readFile(join(root, 'verbatim.txt'));
    expect(onDisk.toString()).toBe('exact');
  });
});
