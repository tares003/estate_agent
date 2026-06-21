import { createHmac, timingSafeEqual } from 'node:crypto';

// EPIC-AC FR-AC-2 — the one-time feedback-request token. A respondent reaches a
// no-sign-in feedback form via an emailed link; this is the signing core that
// authorises it. Structurally identical to @estate/storage's signed-object token
// and the contractor magic-link (HMAC-SHA256 over the payload + an absolute
// expiry, constant-time verify), but with its OWN secret (FEEDBACK_LINK_SECRET).
//
// The token carries the trigger CONTEXT as a signed JSON payload: the tenant, the
// trigger type, the record it is about (soft reference), the agent it is tagged to,
// and an anonymous respondent ref. None can be altered without invalidating the
// signature; verify returns the ATTESTED context (parsed only AFTER the signature
// checks out), so a grafted token cannot retarget the feedback.
//
// Token format: `<payloadB64Url>.<expiryMs>.<sigB64Url>`, payload = base64url(JSON).

/** The trigger context a feedback token attests (FR-AC-4). */
export interface FeedbackContext {
  tenantId: string;
  /** A FeedbackTrigger value (e.g. `viewing_attended`). */
  triggerType: string;
  /** The originating entity kind (e.g. `viewing_request`) — soft reference. */
  triggerEntity?: string;
  /** The originating record id — soft reference. */
  triggerEntityId?: string;
  /** The agent the feedback is tagged to, for the league-table rollup (FR-AC-7). */
  agentActor?: string;
  /** Anonymous respondent identifier (FR-AC-4). */
  respondentRef?: string;
}

/** The HMAC secret for feedback links (fails closed when unset). */
export function feedbackLinkSecret(): string {
  const raw = process.env['FEEDBACK_LINK_SECRET'];
  if (!raw) {
    throw new Error('FEEDBACK_LINK_SECRET is not set');
  }
  return raw;
}

function payloadSegmentOf(context: FeedbackContext): string {
  return Buffer.from(JSON.stringify(context), 'utf8').toString('base64url');
}

/** HMAC-SHA256 over the payload segment + expiry, as URL-safe base64. */
function computeSignature(payloadSegment: string, expiresAtMs: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${payloadSegment}\n${expiresAtMs}`)
    .digest('base64url');
}

/** Mint a signed one-time feedback token binding the trigger context. */
export function signFeedbackToken(
  context: FeedbackContext,
  expiresAtMs: number,
  secret: string,
): string {
  const segment = payloadSegmentOf(context);
  const signature = computeSignature(segment, expiresAtMs, secret);
  return `${segment}.${expiresAtMs}.${signature}`;
}

/**
 * Verify a feedback token. Returns the attested {@link FeedbackContext} when the
 * signature matches and the token has not expired; otherwise null. The payload is
 * parsed only AFTER the signature is validated, so untrusted bytes never reach
 * JSON.parse on a forged token.
 */
export function verifyFeedbackToken(
  token: string,
  secret: string,
  nowMs: number,
): FeedbackContext | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [segment, expirySegment, providedSignature] = parts as [string, string, string];

  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  if (!/^\d+$/.test(expirySegment)) return null;
  const expiresAtMs = Number(expirySegment);
  if (!Number.isSafeInteger(expiresAtMs)) return null;

  const expected = Buffer.from(computeSignature(segment, expiresAtMs, secret), 'utf8');
  const provided = Buffer.from(providedSignature, 'utf8');
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  if (nowMs >= expiresAtMs) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as FeedbackContext).tenantId !== 'string' ||
    typeof (parsed as FeedbackContext).triggerType !== 'string'
  ) {
    return null;
  }
  return parsed as FeedbackContext;
}
