/**
 * Storage abstraction for the platform's object store (CLAUDE.md §9).
 *
 * V1 ships a single local-filesystem implementation; the {@link StorageBackend}
 * interface keeps feature code decoupled from the backend so an S3-compatible
 * implementation (MinIO / R2 / S3) can be swapped in later without touching
 * call-sites. All access is by opaque relative `key`; backends never expose a
 * filesystem path or a pre-signed third-party URL.
 */

/**
 * A content-addressable blob store keyed by an opaque relative `key`.
 *
 * Keys are validated by {@link isSafeKey}; backends MUST reject any key that
 * could escape their storage root. Errors that originate in the backend are
 * surfaced as {@link StorageError} so callers can distinguish a storage failure
 * from any other thrown value.
 */
export interface StorageBackend {
  /** Write `data` at `key`, creating any intermediate structure and overwriting an existing object. */
  put(key: string, data: Buffer | Uint8Array, opts?: { contentType?: string }): Promise<void>;
  /** Read the object at `key`. Throws {@link StorageError} if it does not exist. */
  get(key: string): Promise<Buffer>;
  /** Resolve `true` iff an object exists at `key`. */
  exists(key: string): Promise<boolean>;
  /** Remove the object at `key`. A no-op (not an error) when `key` is absent. */
  delete(key: string): Promise<void>;
}

/** Error raised by a {@link StorageBackend} for any storage-layer failure (missing object, unsafe key, I/O error). */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

/**
 * Guards a storage `key` against path traversal and absolute paths.
 *
 * A key is safe when it is a non-empty relative path that, normalised with `/`
 * separators, contains no `..` segment, no leading separator, no Windows
 * drive-letter prefix, and no NUL byte. Backends call this before resolving a
 * key against their root so an attacker cannot read or write outside it.
 */
export function isSafeKey(key: string): boolean {
  if (key.length === 0) return false;
  // NUL byte — never legal in a path and a classic truncation attack.
  if (key.includes('\u0000')) return false;
  // Windows drive-letter absolute path (e.g. `C:/...`).
  if (/^[a-zA-Z]:/.test(key)) return false;
  // Treat both separators uniformly so `..\\` is caught on POSIX too.
  const normalised = key.replace(/\\/g, '/');
  // Leading separator => absolute / rooted.
  if (normalised.startsWith('/')) return false;
  // Any `..` path segment escapes the root.
  return !normalised.split('/').includes('..');
}
