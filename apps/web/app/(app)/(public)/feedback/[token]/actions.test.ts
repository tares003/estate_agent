import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signFeedbackToken, type FeedbackContext } from '../../../lib/feedback-access.js';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

// G8 — the Turnstile gate is mocked so the action can be exercised without the
// network. Defaults to passing; individual tests flip it to assert fail-closed.
const verifyTurnstile = vi.fn();
vi.mock('../../../lib/turnstile.js', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));

const audit = vi.fn();
const feedbackCreate = vi.fn();
const consentCreate = vi.fn();
const recordConsent = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ feedback: { create: feedbackCreate }, consentLog: { create: consentCreate } }),
);
vi.mock('@estate/db', () => ({
  withTenant,
  audit,
  recordConsent: (...args: unknown[]) => recordConsent(...args),
}));

const { submitFeedback } = await import('./actions.js');

const SECRET = 'test-feedback-secret';
const TENANT = '00000000-0000-0000-0000-000000000001';
const savedSecret = process.env['FEEDBACK_LINK_SECRET'];

const BASE_CONTEXT: FeedbackContext = {
  tenantId: TENANT,
  triggerType: 'viewing_attended',
  triggerEntity: 'viewing_request',
  triggerEntityId: '11111111-1111-1111-1111-111111111111',
  agentActor: 'agent:abc',
  respondentRef: 'anon-9',
};

function token(over: Partial<FeedbackContext> & { expiresInMs?: number } = {}): string {
  const { expiresInMs, ...ctx } = over;
  return signFeedbackToken(
    { ...BASE_CONTEXT, ...ctx },
    Date.now() + (expiresInMs ?? 60_000),
    SECRET,
  );
}

// A well-formed submission carries the token, the GDPR-consent affirmation (G5,
// checkbox → 'on') and a solved Turnstile token (G8). Individual tests override
// or drop these to exercise the fail-closed paths.
function form(tok: string, fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('token', tok);
  fd.set('gdpr_consent', 'on');
  fd.set('cf-turnstile-response', 'turnstile-ok');
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['FEEDBACK_LINK_SECRET'] = SECRET;
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  feedbackCreate.mockResolvedValue({ id: 'fb-1' });
  verifyTurnstile.mockResolvedValue(true);
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env['FEEDBACK_LINK_SECRET'];
  else process.env['FEEDBACK_LINK_SECRET'] = savedSecret;
});

describe('submitFeedback', () => {
  it('rejects an invalid / expired token without writing', async () => {
    const res = await submitFeedback({ ok: false }, form('not-a-token', { rating: '5' }));
    expect(res.ok).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it('rejects a token minted for a different tenant', async () => {
    const res = await submitFeedback(
      { ok: false },
      form(token({ tenantId: '99999999-9999-9999-9999-999999999999' }), { rating: '5' }),
    );
    expect(res.ok).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range rating', async () => {
    const res = await submitFeedback({ ok: false }, form(token(), { rating: '7' }));
    expect(res.ok).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it('persists the feedback with the token context + form values, and audits it', async () => {
    const res = await submitFeedback(
      { ok: false },
      form(token(), { rating: '5', comment: 'Excellent', publishAsTestimonial: 'on' }),
    );
    expect(res.ok).toBe(true);
    expect(feedbackCreate).toHaveBeenCalledTimes(1);
    const data = feedbackCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      tenantId: TENANT,
      triggerType: 'viewing_attended',
      triggerEntity: 'viewing_request',
      triggerEntityId: BASE_CONTEXT.triggerEntityId,
      agentActor: 'agent:abc',
      respondentRef: 'anon-9',
      rating: 5,
      comment: 'Excellent',
      publishAsTestimonial: true,
      needsResponse: false,
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'feedback.submitted',
      entity: 'feedback',
    });
    // The audit diff records that consent was affirmed (G5 audit trail).
    expect(audit.mock.calls[0]![1].diff).toMatchObject({ consentAffirmed: true });
  });

  it('flags needsResponse for a low rating (FR-AC-10) and defaults publish off', async () => {
    await submitFeedback({ ok: false }, form(token(), { rating: '1' }));
    const data = feedbackCreate.mock.calls[0]![0].data;
    expect(data.needsResponse).toBe(true);
    expect(data.publishAsTestimonial).toBe(false);
    expect(data.comment).toBeNull();
  });

  // G8 — the Turnstile anti-spam gate must pass before any DB write.
  it('rejects when the Turnstile challenge fails, without writing (G8)', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const res = await submitFeedback({ ok: false }, form(token(), { rating: '5' }));
    expect(res.ok).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('passes the submitted Turnstile token + client IP to the verifier (G8)', async () => {
    await submitFeedback({ ok: false }, form(token(), { rating: '5' }));
    expect(verifyTurnstile).toHaveBeenCalledWith('turnstile-ok', '203.0.113.7');
  });

  // G5 — the GDPR-consent affirmation is required; a missing / unchecked box is
  // rejected before any DB write.
  it('rejects when GDPR consent is not affirmed, without writing (G5)', async () => {
    const fd = form(token(), { rating: '5' });
    fd.delete('gdpr_consent');
    const res = await submitFeedback({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(feedbackCreate).not.toHaveBeenCalled();
    expect(recordConsent).not.toHaveBeenCalled();
  });

  // G5 — the affirmation is persisted verbatim to consent_logs in the SAME tenant
  // transaction as the feedback row.
  it('records the consent affirmation alongside the feedback (G5)', async () => {
    const res = await submitFeedback({ ok: false }, form(token(), { rating: '5' }));
    expect(res.ok).toBe(true);
    expect(recordConsent).toHaveBeenCalledTimes(1);
    const consentArg = recordConsent.mock.calls[0]![1];
    expect(consentArg).toMatchObject({
      tenantId: TENANT,
      scope: 'feedback_form',
      ipAddress: '203.0.113.7',
    });
    expect(typeof consentArg.consentText).toBe('string');
    expect(consentArg.consentText.length).toBeGreaterThan(0);
    expect(typeof consentArg.subject).toBe('string');
  });
});
