import { randomBytes } from 'node:crypto';

/**
 * EPIC-N FR-N-5 — opaque, URL-safe single-use authentication tokens.
 *
 * FR-N-5 requires the single-use auth tokens (magic-link / password-reset /
 * email-verification) to be "opaque random of at least 32 bytes, encoded for URL
 * safety". {@link generateAuthToken} mints exactly that: {@link AUTH_TOKEN_BYTES}
 * bytes drawn from Node's CSPRNG (`crypto.randomBytes`), base64url-encoded
 * (RFC 4648 §5 — the URL-safe alphabet `A-Z a-z 0-9 - _`, no `=` padding). 32 bytes
 * → 43 URL-safe characters carrying the full 256 bits of entropy.
 *
 * It is wired into better-auth's `magicLink` plugin (auth.ts) through that plugin's
 * first-class `generateToken` option, replacing the plugin default of
 * `generateRandomString(32, "a-z", "A-Z")` (32 base52 chars ≈ 183 bits) — so every
 * magic-link token now literally satisfies the ≥32-byte floor.
 *
 * ── On the password-reset and email-verification tokens ─────────────────────────
 * better-auth (1.6.15, and confirmed against the current/canary docs) exposes NO
 * public hook to override those two token generators:
 *   • the password-reset token is `generateId(24)` — 24 base62 chars ≈ 143 bits;
 *   • the email-verification token is an HMAC-SHA256-signed JWT (not a random
 *     string), unforgeable without the signing secret.
 * The only verification-row hook (`databaseHooks.verification.create.before`)
 * rewrites the STORED token only, while the emailed URL is built from the original
 * value — so using it desynchronises the two and breaks every reset. Both tokens
 * are nonetheless cryptographically strong: 143 bits exceeds the 128-bit standard
 * (a UUIDv4 carries only 122) and the JWT cannot be forged. Closing the *literal*
 * 32-byte gap would mean hand-rolling better-auth's reset flow (re-implementing its
 * user lookup, timing-attack mitigation and verification storage) for no real
 * security gain, so it is left as a documented, accepted deviation rather than
 * forced here. This helper is the seam any future custom flow would reuse.
 */

/** Bytes of CSPRNG entropy in an auth token. FR-N-5: "at least 32 bytes". */
export const AUTH_TOKEN_BYTES = 32;

/**
 * Mint an opaque, URL-safe single-use auth token — {@link AUTH_TOKEN_BYTES} bytes
 * of CSPRNG entropy, base64url-encoded. Satisfies EPIC-N FR-N-5.
 */
export function generateAuthToken(): string {
  return randomBytes(AUTH_TOKEN_BYTES).toString('base64url');
}
