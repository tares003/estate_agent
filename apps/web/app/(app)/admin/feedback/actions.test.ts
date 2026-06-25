import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const feedbackFindFirst = vi.fn();
const feedbackUpdate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ feedback: { findFirst: feedbackFindFirst, update: feedbackUpdate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { moderateFeedback, editFeedback } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const FEEDBACK = '11111111-1111-1111-1111-111111111111';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set('feedbackId', FEEDBACK);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:mod');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  feedbackFindFirst.mockResolvedValue({ id: FEEDBACK, status: 'pending' });
  feedbackUpdate.mockResolvedValue({});
});

describe('moderateFeedback', () => {
  it('denies when the staff role lacks feedback.moderate (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await moderateFeedback({ ok: false }, form({ decision: 'publish' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
  });

  it('publishes a pending entry and audits it', async () => {
    const res = await moderateFeedback({ ok: false }, form({ decision: 'publish' }));
    expect(res.ok).toBe(true);
    expect(feedbackUpdate).toHaveBeenCalledWith({
      where: { id: FEEDBACK },
      data: { status: 'published', rejectedReason: null },
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'feedback.moderated',
      entity: 'feedback',
    });
  });

  it('rejects with a captured reason', async () => {
    const res = await moderateFeedback(
      { ok: false },
      form({ decision: 'reject', reason: 'Off-topic.' }),
    );
    expect(res.ok).toBe(true);
    expect(feedbackUpdate).toHaveBeenCalledWith({
      where: { id: FEEDBACK },
      data: { status: 'rejected', rejectedReason: 'Off-topic.' },
    });
  });

  it('requires a reason when rejecting (FR-AC-5) — no write', async () => {
    const res = await moderateFeedback({ ok: false }, form({ decision: 'reject' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
  });

  it('refuses to re-moderate an entry that is no longer pending', async () => {
    feedbackFindFirst.mockResolvedValue({ id: FEEDBACK, status: 'published' });
    const res = await moderateFeedback({ ok: false }, form({ decision: 'reject', reason: 'x' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
  });

  it('denies a missing feedback id', async () => {
    feedbackFindFirst.mockResolvedValue(null);
    const res = await moderateFeedback({ ok: false }, form({ decision: 'publish' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
  });
});

describe('editFeedback', () => {
  beforeEach(() => {
    feedbackFindFirst.mockResolvedValue({
      id: FEEDBACK,
      status: 'pending',
      comment: 'Orignal coment with typos.',
    });
  });

  it('denies when the staff role lacks feedback.moderate (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await editFeedback(
      { ok: false },
      form({ comment: 'Original comment with typos.' }),
    );
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('applies a minor comment edit and audits the before/after diff', async () => {
    const res = await editFeedback(
      { ok: false },
      form({ comment: '  Original comment, typos fixed.  ' }),
    );
    expect(res.ok).toBe(true);
    expect(feedbackUpdate).toHaveBeenCalledWith({
      where: { id: FEEDBACK },
      data: { comment: 'Original comment, typos fixed.' },
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'feedback.edited',
      entity: 'feedback',
      entityId: FEEDBACK,
      diff: {
        comment: { from: 'Orignal coment with typos.', to: 'Original comment, typos fixed.' },
      },
    });
  });

  it('clears the comment when the edit is blank (null)', async () => {
    const res = await editFeedback({ ok: false }, form({ comment: '   ' }));
    expect(res.ok).toBe(true);
    expect(feedbackUpdate).toHaveBeenCalledWith({
      where: { id: FEEDBACK },
      data: { comment: null },
    });
  });

  it('refuses to edit an entry that is no longer pending', async () => {
    feedbackFindFirst.mockResolvedValue({ id: FEEDBACK, status: 'published', comment: 'x' });
    const res = await editFeedback({ ok: false }, form({ comment: 'late edit' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('denies a missing feedback id', async () => {
    feedbackFindFirst.mockResolvedValue(null);
    const res = await editFeedback({ ok: false }, form({ comment: 'edit' }));
    expect(res.ok).toBe(false);
    expect(feedbackUpdate).not.toHaveBeenCalled();
  });
});
