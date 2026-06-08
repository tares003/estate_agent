import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StorageError, isSafeKey, type StorageBackend } from './backend.js';

/**
 * Node error shape we care about: only `code` is read, and only after confirming
 * the caught value is an object. Keeps us off `any` while reading errno strings.
 */
function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code?: unknown };
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Filesystem-backed {@link StorageBackend} (CLAUDE.md §9 V1 default). Objects are
 * stored as files under a single `root` directory; the storage `key` maps to a
 * relative path beneath it.
 *
 * Every operation validates its key with {@link isSafeKey} before touching the
 * disk, so a traversal (`../`), absolute, or NUL-bearing key throws a
 * {@link StorageError} and can never resolve outside `root`. Missing-object reads
 * surface as {@link StorageError}; missing-object deletes are a no-op.
 */
export class LocalFilesystemBackend implements StorageBackend {
  constructor(private readonly root: string) {}

  /** Validate `key` and resolve it to an absolute path beneath {@link root}. */
  private resolve(key: string): string {
    if (!isSafeKey(key)) {
      throw new StorageError(`unsafe storage key: ${JSON.stringify(key)}`);
    }
    return join(this.root, key);
  }

  // The `opts.contentType` from the StorageBackend contract is intentionally
  // omitted here: the local-filesystem backend stores raw bytes with no sidecar
  // metadata in V1. Omitting the trailing parameter still satisfies the interface.
  async put(key: string, data: Buffer | Uint8Array): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    const path = this.resolve(key);
    try {
      return await readFile(path);
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') {
        throw new StorageError(`object not found: ${key}`, { cause: error });
      }
      throw new StorageError(`failed to read object: ${key}`, { cause: error });
    }
  }

  async exists(key: string): Promise<boolean> {
    const path = this.resolve(key);
    try {
      await stat(path);
      return true;
    } catch (error) {
      const code = errorCode(error);
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return false;
      }
      throw new StorageError(`failed to stat object: ${key}`, { cause: error });
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.resolve(key);
    // `force: true` makes a missing key a no-op, matching the interface contract.
    await rm(path, { force: true });
  }
}
