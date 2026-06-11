import { LocalFilesystemBackend, type StorageBackend } from '@estate/storage';

// CLAUDE.md §9 object storage — the app's binding to the V1 local-filesystem
// StorageBackend and the HMAC secret the signed-URL routes mint/verify tokens
// with. Both fail closed when unconfigured (an unset secret must never silently
// verify). The backend is swappable to S3-compatible later without touching the
// routes or actions that consume this seam.

/** The HMAC secret for signed object tokens (fails closed when unset). */
export function storageSigningSecret(): string {
  const raw = process.env['STORAGE_SIGNING_SECRET'];
  if (!raw) {
    throw new Error('STORAGE_SIGNING_SECRET is not set');
  }
  return raw;
}

/** The configured StorageBackend (local filesystem rooted at STORAGE_DIR). */
export function getStorageBackend(): StorageBackend {
  const root = process.env['STORAGE_DIR'];
  if (!root) {
    throw new Error('STORAGE_DIR is not set');
  }
  return new LocalFilesystemBackend(root);
}
