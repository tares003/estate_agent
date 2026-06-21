'use server';

import { audit, withTenant, type AuditWriter } from '@estate/db';
import { feedbackSubmissionSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import { feedbackLinkSecret, verifyFeedbackToken } from '../../../lib/feedback-access.js';
import { getDb } from '../../../lib/db.js';
import { getCurrentTenantId, getRequestIp } from '../../../lib/tenant.js';

// EPIC-AC FR-AC-2/3/4 — a respondent submits feedback via an emailed no-sign-in
// link. The signed token IS the authorisation (there is no session), so the action
// re-verifies it on every call (stateless) and DERIVES the trigger context from the
// ATTESTED token, never from caller-supplied fields:
//
//  1. verify the signed token → the attested FeedbackContext;
//  2. validate the brief submission (rating + optional comment + publish toggle);
//  3. SECURITY: the row's tenant is the REQUEST tenant (hostname-resolved, EPIC-S);
//     a token whose tenant differs is rejected, so a token cannot be replayed on
//     another tenant's subdomain;
//  4. write the feedback row (needs_response set for a low rating, FR-AC-10) + an
//     audit row, in one tenant transaction (G4). The actor is the anonymous
//     respondent — no personal data is captured (FR-AC-4).

interface FeedbackWriteClient extends AuditWriter {
  feedback: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

/** The result of a feedback submission, consumed by `useActionState`. */
export interface FeedbackFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

/** Rating at or below which the feedback is flagged "needs response" (FR-AC-10). */
const NEEDS_RESPONSE_AT_OR_BELOW = 2;

function deny(message: string): FeedbackFormState {
  return { ok: false, errors: [{ message }] };
}

export async function submitFeedback(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const tokenValue = formData.get('token');
  const context =
    typeof tokenValue === 'string'
      ? verifyFeedbackToken(tokenValue, feedbackLinkSecret(), Date.now())
      : null;
  if (context === null) {
    return deny('This feedback link is invalid or has expired.');
  }

  const parsed = feedbackSubmissionSchema.safeParse({
    rating: formData.get('rating'),
    comment: formData.get('comment') ?? undefined,
    publishAsTestimonial: formData.get('publishAsTestimonial') === 'on',
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

  const tenantId = await getCurrentTenantId();
  // A token minted for another tenant must not write into this one.
  if (context.tenantId !== tenantId) {
    return deny('This feedback link is invalid or has expired.');
  }
  const ip = await getRequestIp();
  const { rating, comment, publishAsTestimonial } = parsed.data;
  const needsResponse = rating <= NEEDS_RESPONSE_AT_OR_BELOW;

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as FeedbackWriteClient;
    const created = await tx.feedback.create({
      data: {
        tenantId,
        triggerType: context.triggerType,
        triggerEntity: context.triggerEntity ?? null,
        triggerEntityId: context.triggerEntityId ?? null,
        agentActor: context.agentActor ?? null,
        respondentRef: context.respondentRef ?? null,
        rating,
        comment: comment ?? null,
        publishAsTestimonial,
        needsResponse,
      },
    });
    await audit(tx, {
      tenantId,
      actor: context.respondentRef ? `respondent:${context.respondentRef}` : 'respondent:anonymous',
      action: 'feedback.submitted',
      entity: 'feedback',
      entityId: created.id,
      diff: { rating, publishAsTestimonial, needsResponse },
      ip,
    });
  });

  return { ok: true };
}
