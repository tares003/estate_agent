'use server';

import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import { feedbackSubmissionSchema } from '@estate/validators';
import type { FormErrorItem } from '@estate/ui';

import {
  feedbackLinkSecret,
  feedbackTokenDigest,
  verifyFeedbackToken,
} from '../../../lib/feedback-access.js';
import { getDb } from '../../../lib/db.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../lib/tenant.js';
import { verifyTurnstile } from '../../../lib/turnstile.js';
import { FEEDBACK_CONSENT_TEXT } from '../consent-text.js';

// EPIC-AC FR-AC-2/3/4 — a respondent submits feedback via an emailed no-sign-in
// link. The signed token IS the authorisation (there is no session), so the action
// re-verifies it on every call (stateless) and DERIVES the trigger context from the
// ATTESTED token, never from caller-supplied fields:
//
//  1. verify the signed token → the attested FeedbackContext;
//  2. validate the brief submission (rating + optional comment + publish toggle +
//     the required GDPR-consent affirmation, G5);
//  3. anti-spam: verify the Cloudflare Turnstile token server-side BEFORE any write
//     (G8) — a failed / missing challenge is rejected fail-closed;
//  4. SECURITY: the row's tenant is the REQUEST tenant (hostname-resolved, EPIC-S);
//     a token whose tenant differs is rejected, so a token cannot be replayed on
//     another tenant's subdomain;
//  5. SINGLE USE (FR-AC-2): the token's digest is looked up FIRST inside the
//     tenant transaction — a token whose feedback already exists is rejected with
//     a friendly already-submitted state, writing nothing (no consent row, no
//     feedback row, no audit row — a replay is not a new submission). The digest
//     is persisted with the row under a per-tenant unique constraint, so a
//     concurrent race falls back to the same state via the constraint (the whole
//     transaction rolls back);
//  6. record the consent affirmation verbatim (G5) + write the feedback row
//     (needs_response set for a low rating, FR-AC-10) + an audit row, all in one
//     tenant transaction (G4). The actor is the anonymous respondent.

interface FeedbackWriteClient extends ConsentWriter, AuditWriter {
  feedback: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findFirst(args: {
      where: Record<string, unknown>;
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

/** The result of a feedback submission, consumed by `useActionState`. */
export interface FeedbackFormState {
  ok: boolean;
  /** Set when the one-time link was already redeemed (FR-AC-2) — no new write. */
  alreadySubmitted?: boolean;
  errors?: FormErrorItem[];
}

/** Rating at or below which the feedback is flagged "needs response" (FR-AC-10). */
const NEEDS_RESPONSE_AT_OR_BELOW = 2;

function deny(message: string): FeedbackFormState {
  return { ok: false, errors: [{ message }] };
}

/** Thrown inside the tenant tx when the token's feedback already exists. */
class AlreadySubmittedError extends Error {
  constructor() {
    super('feedback token already redeemed');
  }
}

/** A Prisma P2002 unique-constraint violation (the single-use race backstop). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

export async function submitFeedback(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const tokenValue = formData.get('token');
  const token = typeof tokenValue === 'string' ? tokenValue : null;
  const context =
    token === null ? null : verifyFeedbackToken(token, feedbackLinkSecret(), Date.now());
  if (token === null || context === null) {
    return deny('This feedback link is invalid or has expired.');
  }

  const parsed = feedbackSubmissionSchema.safeParse({
    rating: formData.get('rating'),
    comment: formData.get('comment') ?? undefined,
    publishAsTestimonial: formData.get('publishAsTestimonial') === 'on',
    gdpr_consent: formData.get('gdpr_consent') === 'on',
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
  const userAgent = await getRequestUserAgent();

  // Anti-spam gate (G8): verify the Turnstile token server-side BEFORE any write.
  const turnstileToken = formData.get('cf-turnstile-response');
  const challengePassed = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : null,
    ip,
  );
  if (!challengePassed) {
    return deny('We couldn’t verify the security challenge. Please try again.');
  }

  const { rating, comment, publishAsTestimonial } = parsed.data;
  const needsResponse = rating <= NEEDS_RESPONSE_AT_OR_BELOW;
  // The anonymous respondent is the consent subject (no personal identifier is
  // captured; the token's opaque respondent ref is used when present, FR-AC-4).
  const consentSubject = context.respondentRef ?? 'anonymous';
  // FR-AC-2 — the digest under which this one-time token is consumed.
  const tokenDigest = feedbackTokenDigest(token);

  try {
    await withTenant(getDb(), tenantId, async (rawTx) => {
      const tx = rawTx as unknown as FeedbackWriteClient;
      // FR-AC-2 single-use gate, BEFORE any write: a token whose feedback already
      // exists has been redeemed — a replay writes nothing.
      const redeemed = await tx.feedback.findFirst({
        where: { tokenDigest },
        select: { id: true },
      });
      if (redeemed !== null) {
        throw new AlreadySubmittedError();
      }
      // G5 — persist the exact affirmation the respondent agreed to, verbatim, in
      // the same tenant transaction as the feedback row.
      await recordConsent(tx, {
        tenantId,
        scope: 'feedback_form',
        subject: consentSubject,
        consentText: FEEDBACK_CONSENT_TEXT,
        ipAddress: ip,
      });
      const created = await tx.feedback.create({
        data: {
          tenantId,
          triggerType: context.triggerType,
          triggerEntity: context.triggerEntity ?? null,
          triggerEntityId: context.triggerEntityId ?? null,
          agentActor: context.agentActor ?? null,
          respondentRef: context.respondentRef ?? null,
          tokenDigest,
          rating,
          comment: comment ?? null,
          publishAsTestimonial,
          needsResponse,
        },
      });
      await audit(tx, {
        tenantId,
        actor: context.respondentRef
          ? `respondent:${context.respondentRef}`
          : 'respondent:anonymous',
        action: 'feedback.submitted',
        entity: 'feedback',
        entityId: created.id,
        diff: { rating, publishAsTestimonial, needsResponse, consentAffirmed: true },
        ip,
        userAgent,
      });
    });
  } catch (error) {
    // The friendly already-submitted state: the read-first gate, or — when two
    // submissions race past it — the per-tenant unique constraint on the token
    // digest (P2002). Either way the transaction rolled back: nothing was
    // written and no audit row records a new submission.
    if (error instanceof AlreadySubmittedError || isUniqueViolation(error)) {
      return { ok: false, alreadySubmitted: true };
    }
    throw error;
  }

  return { ok: true };
}
