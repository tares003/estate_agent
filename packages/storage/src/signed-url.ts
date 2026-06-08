import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signing core for the signed-object-URL route handler (CLAUDE.md §9 — files are
 * served through a signed-URL route, not pre-signed third-party URLs).
 *
 * A token binds a storage `key` to an absolute expiry (epoch ms) under an
 * HMAC-SHA256 keyed by a server-side `secret`. The token format is
 * `<keyB64Url>.<expiryMs>.<sigB64Url>`; the signature covers `key` and `expiry`
 * together so neither can be altered without invalidating it. Verification is
 * constant-time and rejects expired or tampered tokens by returning `null`.
 */

/** URL-safe base64 (no padding) of a UTF-8 string. */
function encodeSegment(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/** Inverse of {@link encodeSegment}; returns `null` if the segment is not valid base64url. */
function decodeSegment(segment: string): string | null {
  // base64url alphabet only; reject anything else outright.
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  return Buffer.from(segment, 'base64url').toString('utf8');
}

/** HMAC-SHA256 over `key` and `expiry`, returned as URL-safe base64. */
function computeSignature(key: string, expiresAtMs: number, secret: string): string {
  return createHmac('sha256', secret).update(`${key}\n${expiresAtMs}`).digest('base64url');
}

/**
 * Mint a signed token for `key`, valid until `expiresAtMs` (epoch ms), under `secret`.
 * Deterministic: identical inputs yield an identical token.
 */
export function signObjectToken(key: string, expiresAtMs: number, secret: string): string {
  const signature = computeSignature(key, expiresAtMs, secret);
  return `${encodeSegment(key)}.${expiresAtMs}.${signature}`;
}

/**
 * Verify `token` under `secret` at `nowMs`. Returns the attested `{ key }` when
 * the signature matches and the token has not expired; otherwise `null`.
 *
 * Returns the key the token actually attests — never a caller-supplied key — so a
 * grafted/swapped token cannot be made to authorise a different object.
 */
export function verifyObjectToken(
  token: string,
  secret: string,
  nowMs: number,
): { key: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [keySegment, expirySegment, providedSignature] = parts as [string, string, string];

  const key = decodeSegment(keySegment);
  if (key === null) return null;

  // Expiry must be a finite integer; a non-numeric segment is invalid.
  if (!/^\d+$/.test(expirySegment)) return null;
  const expiresAtMs = Number(expirySegment);
  if (!Number.isSafeInteger(expiresAtMs)) return null;

  const expectedSignature = computeSignature(key, expiresAtMs, secret);
  const expectedBytes = Buffer.from(expectedSignature, 'utf8');
  const providedBytes = Buffer.from(providedSignature, 'utf8');
  // Length-guard before timingSafeEqual (which throws on a length mismatch).
  if (expectedBytes.length !== providedBytes.length) return null;
  if (!timingSafeEqual(expectedBytes, providedBytes)) return null;

  // Expiry is exclusive: at or after the instant, the token is dead.
  if (nowMs >= expiresAtMs) return null;

  return { key };
}
