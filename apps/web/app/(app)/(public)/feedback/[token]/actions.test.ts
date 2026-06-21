import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signFeedbackToken, type FeedbackContext } from '../../../lib/feedback-access.js';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const feedbackCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ feedback: { create: feedbackCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

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

function form(tok: string, fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('token', tok);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['FEEDBACK_LINK_SECRET'] = SECRET;
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  feedbackCreate.mockResolvedValue({ id: 'fb-1' });
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
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'feedback.submitted', entity: 'feedback' });
  });

  it('flags needsResponse for a low rating (FR-AC-10) and defaults publish off', async () => {
    await submitFeedback({ ok: false }, form(token(), { rating: '1' }));
    const data = feedbackCreate.mock.calls[0]![0].data;
    expect(data.needsResponse).toBe(true);
    expect(data.publishAsTestimonial).toBe(false);
    expect(data.comment).toBeNull();
  });
});
