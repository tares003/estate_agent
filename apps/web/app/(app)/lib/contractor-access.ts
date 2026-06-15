import { createHmac, timingSafeEqual } from 'node:crypto';

// FR-G-8 — the contractor magic-link token. A contractor accesses one assigned
// repair ticket "without signing in" via an emailed link; this is the signing
// core that authorises it. Structurally identical to @estate/storage's
// signed-object token (HMAC-SHA256 over the payload + an absolute expiry, with a
// constant-time verify), but kept separate with its OWN secret
// (CONTRACTOR_LINK_SECRET) — a leaked storage key must never grant ticket access,
// nor the reverse. The token binds a `repairRequestId` and a `contractorId`
// together so neither can be altered without invalidating the signature; verify
// returns the ATTESTED ids, never caller-supplied ones, so a grafted token cannot
// authorise a different ticket or contractor. Expired / tampered / wrong-secret
// tokens return null.
//
// Token format: `<payloadB64Url>.<expiryMs>.<sigB64Url>`, payload `<repair>:<contractor>`.

/** The HMAC secret for contractor magic-links (fails closed when unset). */
export function contractorLinkSecret(): string {
  const raw = process.env['CONTRACTOR_LINK_SECRET'];
  if (!raw) {
    throw new Error('CONTRACTOR_LINK_SECRET is not set');
  }
  return raw;
}

function payloadOf(repairRequestId: string, contractorId: string): string {
  return `${repairRequestId}:${contractorId}`;
}

/** HMAC-SHA256 over the payload + expiry, as URL-safe base64. */
function computeSignature(payload: string, expiresAtMs: number, secret: string): string {
  return createHmac('sha256', secret).update(`${payload}\n${expiresAtMs}`).digest('base64url');
}

/** Mint a signed magic-link token for a contractor's access to one ticket. */
export function signContractorLink(
  repairRequestId: string,
  contractorId: string,
  expiresAtMs: number,
  secret: string,
): string {
  const payload = payloadOf(repairRequestId, contractorId);
  const signature = computeSignature(payload, expiresAtMs, secret);
  const payloadSegment = Buffer.from(payload, 'utf8').toString('base64url');
  return `${payloadSegment}.${expiresAtMs}.${signature}`;
}

/**
 * Verify a contractor magic-link. Returns the attested `{ repairRequestId,
 * contractorId }` when the signature matches and the token has not expired;
 * otherwise null.
 */
export function verifyContractorLink(
  token: string,
  secret: string,
  nowMs: number,
): { repairRequestId: string; contractorId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [payloadSegment, expirySegment, providedSignature] = parts as [string, string, string];

  if (!/^[A-Za-z0-9_-]+$/.test(payloadSegment)) return null;
  const payload = Buffer.from(payloadSegment, 'base64url').toString('utf8');
  const [repairRequestId, contractorId] = payload.split(':');
  if (!repairRequestId || !contractorId) return null;

  if (!/^\d+$/.test(expirySegment)) return null;
  const expiresAtMs = Number(expirySegment);
  if (!Number.isSafeInteger(expiresAtMs)) return null;

  const expected = Buffer.from(computeSignature(payload, expiresAtMs, secret), 'utf8');
  const provided = Buffer.from(providedSignature, 'utf8');
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  if (nowMs >= expiresAtMs) return null;

  return { repairRequestId, contractorId };
}
