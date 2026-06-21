import { describe, expect, it } from 'vitest';

import {
  feedbackLinkSecret,
  signFeedbackToken,
  verifyFeedbackToken,
  type FeedbackContext,
} from './feedback-access.js';

// EPIC-AC FR-AC-2 — the one-time feedback-request token. The respondent reaches a
// no-sign-in feedback form via an emailed link; this is the signing core. The token
// binds the trigger CONTEXT (tenant + trigger type + the record it is about + the
// agent it is tagged to), so none of it can be altered without invalidating the
// signature; verify returns the ATTESTED context, never caller-supplied values.

const SECRET = 'feedback-test-secret';
const NOW = 1_900_000_000_000;
const CONTEXT: FeedbackContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  triggerType: 'viewing_attended',
  triggerEntity: 'viewing_request',
  triggerEntityId: '22222222-2222-2222-2222-222222222222',
  agentActor: 'agent:abc',
  respondentRef: 'anon-123',
};

describe('signFeedbackToken / verifyFeedbackToken', () => {
  it('round-trips the full trigger context', () => {
    const token = signFeedbackToken(CONTEXT, NOW + 60_000, SECRET);
    expect(verifyFeedbackToken(token, SECRET, NOW)).toEqual(CONTEXT);
  });

  it('round-trips a minimal context (just tenant + trigger type)', () => {
    const minimal: FeedbackContext = { tenantId: CONTEXT.tenantId, triggerType: 'repair_completed' };
    const token = signFeedbackToken(minimal, NOW + 60_000, SECRET);
    expect(verifyFeedbackToken(token, SECRET, NOW)).toEqual(minimal);
  });

  it('rejects an expired token', () => {
    const token = signFeedbackToken(CONTEXT, NOW - 1, SECRET);
    expect(verifyFeedbackToken(token, SECRET, NOW)).toBeNull();
  });

  it('rejects a wrong secret', () => {
    const token = signFeedbackToken(CONTEXT, NOW + 60_000, SECRET);
    expect(verifyFeedbackToken(token, 'other-secret', NOW)).toBeNull();
  });

  it('rejects a tampered payload (changed entity id) — signature no longer matches', () => {
    const token = signFeedbackToken(CONTEXT, NOW + 60_000, SECRET);
    const [, expiry, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...CONTEXT, triggerEntityId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }),
      'utf8',
    ).toString('base64url');
    expect(verifyFeedbackToken(`${forged}.${expiry}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'a.b', 'a.b.c.d', 'not-base64url!.123.sig', 'seg.notanumber.sig']) {
      expect(verifyFeedbackToken(bad, SECRET, NOW)).toBeNull();
    }
  });
});

describe('feedbackLinkSecret', () => {
  it('returns the configured secret and throws (fail-closed) when unset', () => {
    const original = process.env['FEEDBACK_LINK_SECRET'];
    try {
      process.env['FEEDBACK_LINK_SECRET'] = 'configured';
      expect(feedbackLinkSecret()).toBe('configured');
      delete process.env['FEEDBACK_LINK_SECRET'];
      expect(() => feedbackLinkSecret()).toThrow(/FEEDBACK_LINK_SECRET/);
    } finally {
      if (original === undefined) delete process.env['FEEDBACK_LINK_SECRET'];
      else process.env['FEEDBACK_LINK_SECRET'] = original;
    }
  });
});
