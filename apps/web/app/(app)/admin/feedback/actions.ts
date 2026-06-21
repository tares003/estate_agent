'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { feedbackDecisionStatus, feedbackModerationSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getStaffActor, requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp } from '../../lib/tenant.js';

// EPIC-AC FR-AC-5 — a staff member moderates a publishable feedback entry: publish
// it (→ flows to testimonials) or reject it WITH a reason. RBAC fail-closed before
// any write (requireStaffPermission('feedback.moderate')); the entry must still be
// `pending` (no re-moderation); the transition + the captured reject reason are
// written with an audit row in one tenant transaction (G4).

interface FeedbackModerateClient extends AuditWriter {
  feedback: {
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string; status: string } | null>;
    update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** The result of a moderation decision, consumed by `useActionState`. */
export interface FeedbackModerateState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function deny(message: string): FeedbackModerateState {
  return { ok: false, errors: [{ message }] };
}

export async function moderateFeedback(
  _prevState: FeedbackModerateState,
  formData: FormData,
): Promise<FeedbackModerateState> {
  try {
    await requireStaffPermission('feedback.moderate');
  } catch {
    return deny('You do not have permission to moderate feedback.');
  }

  const parsed = feedbackModerationSchema.safeParse({
    decision: formData.get('decision'),
    reason: formData.get('reason') ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => {
        const field = issue.path.join('.');
        return field ? { field, message: issue.message } : { message: issue.message };
      }),
    };
  }

  const feedbackId = formData.get('feedbackId');
  if (typeof feedbackId !== 'string' || feedbackId.length === 0) {
    return deny('This feedback could not be found.');
  }

  const status = feedbackDecisionStatus(parsed.data.decision);
  const reason = parsed.data.reason ?? null;
  const tenantId = await getCurrentTenantId();
  const actor = await getStaffActor();
  const ip = await getRequestIp();

  let result: FeedbackModerateState = deny('This feedback could not be found.');
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as FeedbackModerateClient;
    const existing = await tx.feedback.findFirst({ where: { id: feedbackId } });
    if (!existing) {
      return; // not-found default
    }
    if (existing.status !== 'pending') {
      result = deny('This feedback has already been moderated.');
      return;
    }
    await tx.feedback.update({
      where: { id: feedbackId },
      data: { status, rejectedReason: reason },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'feedback.moderated',
      entity: 'feedback',
      entityId: feedbackId,
      diff: { status: { from: 'pending', to: status }, reason },
      ip,
    });
    result = { ok: true };
  });
  return result;
}
