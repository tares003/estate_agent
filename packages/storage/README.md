# @estate/storage

The object-storage abstraction. V1 default is local filesystem; the interface preserves the swap path to S3-compatible (MinIO / R2 / S3) without touching feature code.

## Interface

```typescript
interface StorageBackend {
  put(key: string, data: Buffer | ReadableStream, opts?: PutOptions): Promise<{ url: string }>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
```

## V1 implementation — local filesystem

- Files live under `MEDIA_ROOT` on the Hetzner host (path from env).
- `put` writes the file with a content-addressable key (SHA-256 of contents + extension).
- `signedUrl` returns a URL to the Next.js `/api/media/[token]` route handler with a short-lived signed token (HMAC); the route handler validates the signature and streams the file.
- `delete` is soft-delete in V1 (file moved to `MEDIA_ROOT/.trash/<date>/`); a scheduled worker hard-deletes after the retention window.

## Swap path

`S3StorageBackend` (MinIO / R2 / S3) lives in the same package. Selected via `STORAGE_BACKEND=local|s3` env. The signed-URL route handler is bypassed for S3 (uses pre-signed S3 URLs directly).

## Discipline

Round-trip tests against both backends in CI (S3 tested via a MinIO container). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B0 (foundation).
