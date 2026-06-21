'use server';

import { canRepairTransition, repairStatusUpdateSchema } from '@estate/validators';
import { audit, notify, withTenant, type AuditWriter, type NotificationWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import { feedbackLinkSecret, signFeedbackToken } from '../../../lib/feedback-access.js';
import {
  getStaffActor,
  getStaffUserId,
  requireStaffPermission,
} from '../../../lib/staff-session.js';
import { getCurrentTenantId, getRequestIp, getRequestOrigin } from '../../../lib/tenant.js';
import { shouldRequestRepairFeedback } from './feedback-trigger.js';

// EPIC-G repair triage (master spec §G.5, FR-G-6/FR-G-7): a staff member advances a
// ticket through the status workflow. RBAC-gated on `repair_request.write`
// (fail-closed before any read/write). Transitions are held to the §G.5 allow-list
// (illegal moves are refused before any write); rejecting requires a reason, which
// is stored on the ticket's `rejected_reason` (§G.6). Every transition writes BOTH
// a `repair_status_history` row (from/to, actor, notes — FR-G-7) AND an
// `audit_logs` row, inside the same tenant (RLS) transaction (G4). A transition
// INTO `completed` additionally queues a post-repair feedback request to the
// reporter in the same transaction (EPIC-AC FR-AC-1/12), best-effort — see below.
// Drives a form via `useActionState`.

interface RepairTriageClient extends AuditWriter, NotificationWriter {
  repairRequest: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string; status: string; email: string | null } | null>;
    update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  repairStatusEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** ~30 days for the post-repair feedback link to be used (FR-AC-1/12). */
const FEEDBACK_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The result of a status change, consumed by `useActionState`. */
export interface RepairStatusState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function setRepairStatus(
  _prevState: RepairStatusState,
  formData: FormData,
): Promise<RepairStatusState> {
  const parsed = repairStatusUpdateSchema.safeParse({
    repairId: field(formData, 'repairId'),
    to: field(formData, 'to'),
    notes: field(formData, 'notes'),
  });
  if (!parsed.success) {
    const errors: FormErrorItem[] = parsed.error.issues.map((issue) => {
      const fieldKey = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
      return fieldKey === undefined
        ? { message: issue.message }
        : { field: fieldKey, message: issue.message };
    });
    return { ok: false, errors };
  }

  // RBAC gate — fail closed BEFORE any read/write.
  try {
    await requireStaffPermission('repair_request.write');
  } catch {
    return { ok: false, errors: [{ message: 'You do not have permission to manage repairs.' }] };
  }

  const { repairId, to, notes } = parsed.data;
  const actor = await getStaffActor();
  const actorUserId = await getStaffUserId();
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();

  let result: RepairStatusState = { ok: false, errors: [{ message: 'Repair not found.' }] };
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairTriageClient;
    const existing = await tx.repairRequest.findFirst({ where: { id: repairId } });
    if (!existing) {
      return; // result stays the not-found default
    }
    const from = existing.status;
    if (!canRepairTransition(from, to)) {
      result = {
        ok: false,
        errors: [{ message: `This repair cannot move from its current status to "${to}".` }],
      };
      return;
    }
    const data: Record<string, unknown> = { status: to };
    if (to === 'rejected') {
      data['rejectedReason'] = notes;
    }
    await tx.repairRequest.update({ where: { id: repairId }, data });
    await tx.repairStatusEvent.create({
      data: {
        tenantId,
        repairRequestId: repairId,
        fromStatus: from,
        toStatus: to,
        actorUserId,
        notes: notes ?? null,
      },
    });
    await audit(tx, {
      tenantId,
      actor,
      action: 'repair_request.status_changed',
      entity: 'repair_request',
      entityId: repairId,
      diff: { status: { from, to } },
      ip,
    });

    // EPIC-AC FR-AC-1/12: a transition INTO `completed` queues a post-repair
    // feedback request to the reporter, in THIS same tenant transaction (the
    // worker renders + dispatches it — §H.13). Best-effort: it only fires when
    // FEEDBACK_LINK_SECRET is configured AND the reporter left an email, and a
    // failure here (e.g. unset secret) must never roll back the status change —
    // so it is wrapped in its own try/catch. The token binds the
    // `repair_completed` trigger to THIS ticket (its own secret); the respondent
    // ref is the soft `repair:<id>` reference (no personal data in the link).
    if (shouldRequestRepairFeedback(from, to) && existing.email) {
      const recipient = existing.email;
      try {
        const token = signFeedbackToken(
          {
            tenantId,
            triggerType: 'repair_completed',
            triggerEntity: 'repair_request',
            triggerEntityId: repairId,
            respondentRef: `repair:${repairId}`,
          },
          Date.now() + FEEDBACK_TOKEN_TTL_MS,
          feedbackLinkSecret(),
        );
        const url = `${await getRequestOrigin()}/feedback/${token}`;
        await notify(tx, {
          tenantId,
          event: 'feedback.requested',
          channel: 'email',
          recipient,
          payload: { url },
        });
      } catch {
        // Best-effort (FR-AC-12): the status change must stand even if the
        // feedback request can't be minted or queued.
      }
    }

    result = { ok: true };
  });
  return result;
}
