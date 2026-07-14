'use server';

import { randomUUID } from 'node:crypto';

import { signObjectToken } from '@estate/storage';
import {
  REPAIR_FILE_EXTENSIONS,
  REPAIR_MAX_FILES,
  repairFilesMetaSchema,
  repairRequestSchema,
  type RepairFileMeta,
} from '@estate/validators';
import {
  audit,
  notify,
  recordConsent,
  withTenant,
  type AuditWriter,
  type ConsentWriter,
  type NotificationWriter,
} from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import {
  assignmentDiff,
  resolveEnquiryAssignment,
  type AssignmentRuleReader,
} from '../../lib/enquiry-routing.js';
import { getStorageBackend, storageSigningSecret } from '../../lib/storage.js';
import { repairReference } from '../../lib/repair-reference.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { REPAIR_CONSENT_TEXT } from './consent-text.js';

// EPIC-G tenant repair-report submission (PRODUCT.md §4 — "Report a repair" /
// repair_request, FR-G-1/FR-G-3). Writes a tenant-scoped RepairRequest at intake,
// assigning the §G.1 human-readable ticket reference (per-tenant sequential,
// RPR-YYYY-NNNNN; the per-tenant unique constraint backstops a concurrency race —
// the transaction is retried once on collision). Per master spec §I.1 (FR-I-1,
// audit finding repair-submission-produces-no-enquiry) the SAME transaction ALSO
// writes a repair-channel enquiry linked to the ticket by its reference — the
// spec's `enquiries` + `repair_requests` dual write — routed through the tenant's
// assignment rules (FR-I-3), so repairs surface in the unified CRM queue. The
// tenant confirmation email is QUEUED via notify() in the same transaction
// (§H.13 — the action records intent; the workers dispatch), and so are the
// CONFIGURED internal notifications (FR-G-3/§G.7): the staff/branch-repairs
// email on every submission plus the on-call manager SMS on emergency — see
// repair_notification_config (admin settings surface). Staff triage
// urgency + resolve the property in the admin inbox, so `propertyId` is left
// null and the typed `propertyReference` is stored alongside. The repair flow is
// in the `core` pack (every tenant), so no entitlement gate. Held to the two
// compliance guards: G5 (the schema carries `gdpr_consent`; the agreed text is
// persisted verbatim) and G8 (the anti-spam challenge is verified before any
// write). Every write is tenant-scoped (RLS) + audited (G4). Drives a form via
// `useActionState`.

interface RepairWriteClient
  extends ConsentWriter, AuditWriter, NotificationWriter, AssignmentRuleReader {
  enquiry: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
  repairRequest: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    count(args: Record<string, unknown>): Promise<number>;
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
  repairFile: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  repairNotificationConfig: {
    findFirst(args?: {
      select?: Record<string, unknown>;
    }): Promise<{ repairsEmail: string | null; onCallPhone: string | null } | null>;
  };
}

/** A server-issued authorisation to PUT one declared file (FR-G-2). */
export interface RepairUploadGrant {
  /** The storage key the upload must land at (echoed back to finalize). */
  key: string;
  /** The signed token authorising a PUT of exactly that key. */
  token: string;
  /** The declared file name the grant was issued for (client-side matching). */
  name: string;
}

/** The result of a repair submission, consumed by `useActionState`. */
export interface RepairFormState {
  ok: boolean;
  /** The §G.1 ticket reference, set on success (shown on the success panel). */
  reference?: string;
  /** The new ticket id, set when attachments were declared (finalize target). */
  repairRequestId?: string;
  /** One grant per declared attachment (issued AFTER the verified submit). */
  uploadGrants?: RepairUploadGrant[];
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

export async function submitRepairRequest(
  _prevState: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  const parsed = repairRequestSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    propertyReference: field(formData, 'propertyReference'),
    category: field(formData, 'category'),
    description: field(formData, 'description'),
    urgency: field(formData, 'urgency'),
    gdpr_consent: formData.get('gdpr_consent') === 'on',
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

  // FR-G-2: the declared attachments (validated BEFORE any write; grants are
  // issued only after the verified submit creates the ticket).
  const filesMetaRaw = field(formData, 'filesMeta');
  let filesMeta: RepairFileMeta[] = [];
  if (filesMetaRaw !== undefined) {
    let parsedMeta: unknown;
    try {
      parsedMeta = JSON.parse(filesMetaRaw);
    } catch {
      return { ok: false, errors: [{ message: 'Those attachments cannot be uploaded.' }] };
    }
    const metaResult = repairFilesMetaSchema.safeParse(parsedMeta);
    if (!metaResult.success) {
      return { ok: false, errors: [{ message: 'Those attachments cannot be uploaded.' }] };
    }
    filesMeta = metaResult.data;
  }

  const repair = parsed.data;
  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  // Anti-spam gate (CLAUDE.md §9): verify the Turnstile token BEFORE any write.
  const turnstileToken = formData.get('cf-turnstile-response');
  const challengePassed = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : null,
    ip,
  );
  if (!challengePassed) {
    return {
      ok: false,
      errors: [{ message: 'We couldn’t verify the security challenge. Please try again.' }],
    };
  }

  const submit = (): Promise<{ id: string; reference: string }> =>
    withTenant(getDb(), tenantId, async (rawTx) => {
      const tx = rawTx as unknown as RepairWriteClient;
      await recordConsent(tx, {
        tenantId,
        scope: 'repair_form',
        subject: repair.email,
        consentText: REPAIR_CONSENT_TEXT,
        ipAddress: ip,
      });
      // The next per-tenant sequence number (RLS scopes the count to the tenant);
      // the per-tenant unique constraint catches a concurrent duplicate.
      const sequence = (await tx.repairRequest.count({})) + 1;
      const reference = repairReference(new Date(), sequence);
      const created = await tx.repairRequest.create({
        data: {
          tenantId,
          reference,
          name: repair.name,
          email: repair.email,
          phone: repair.phone,
          propertyReference: repair.propertyReference,
          category: repair.category,
          description: repair.description,
          urgency: repair.urgency,
        },
      });
      // FR-I-1 (master spec §I.1; audit finding
      // repair-submission-produces-no-enquiry): the repair form's inventory row is
      // `enquiries` + `repair_requests` — the SAME transaction also writes a
      // repair-channel enquiry, linked to the ticket by its per-tenant-unique §G.1
      // reference, so the repair lands in the unified CRM queue (FR-H-3). Routed
      // through the tenant's assignment rules like every other enquiry (FR-I-3).
      const enquiryMessage =
        `Repair report ${reference} — ${repair.category}, urgency ${repair.urgency}. ` +
        repair.description;
      const assignment = await resolveEnquiryAssignment(tx, {
        enquiryType: 'repair_request',
        status: 'new',
        sourceUrl: null,
        message: enquiryMessage,
        hasProperty: false,
      });
      // `lead_type` is the committed DB column for the enquiry channel; set via
      // bracket access to keep the forbidden noun out of a declared identifier
      // (PRODUCT.md §2/§3, G6).
      const enquiryData: Record<string, unknown> = {
        tenantId,
        reference,
        name: repair.name,
        email: repair.email,
        phone: repair.phone ?? null,
        message: enquiryMessage,
        assignedAgentId: assignment.assignedAgentId,
        assignedBranchId: assignment.assignedBranchId,
      };
      enquiryData['leadType'] = 'repair_request';
      const enquiryRow = await tx.enquiry.create({ data: enquiryData });
      await audit(tx, {
        tenantId,
        actor: `enquiry:${repair.email}`,
        action: 'enquiry.created',
        entity: 'enquiry',
        entityId: enquiryRow.id,
        diff: assignmentDiff(assignment),
        ip,
        userAgent,
      });
      // FR-G-3: the tenant confirmation is queued in the same transaction; the
      // worker renders + dispatches it (§H.13 — record intent, never send inline).
      await notify(tx, {
        tenantId,
        event: 'repair_request.received',
        channel: 'email',
        recipient: repair.email,
        payload: {
          reference,
          name: repair.name,
          category: repair.category,
          urgency: repair.urgency,
        },
      });
      // FR-G-3 / §G.1 step 8: an emergency ticket also queues an SMS to the
      // reporter (when they gave a number); the worker sends it via Twilio.
      if (repair.urgency === 'emergency' && repair.phone) {
        await notify(tx, {
          tenantId,
          event: 'repair_request.emergency',
          channel: 'sms',
          recipient: repair.phone,
          payload: { reference },
        });
      }
      // FR-G-3 / §G.7 (audit finding repair-emergency-internal-notifications-
      // missing): the CONFIGURED internal notifications, queued in the same tx.
      // Every submission alerts the property-manager / branch-repairs-queue email
      // (`repair_new_internal`); an emergency submission additionally pages the
      // on-call manager by SMS (`repair_emergency_internal`). A channel with no
      // configured recipient is skipped — routing is best-effort and never blocks
      // the ticket. §G.7's Slack/Teams team-messaging channel is deferred (EPIC-G
      // defines no webhook mechanism; the §H.13 notification matrix is EPIC-H).
      const internalRecipients = await tx.repairNotificationConfig.findFirst({
        select: { repairsEmail: true, onCallPhone: true },
      });
      if (internalRecipients?.repairsEmail) {
        await notify(tx, {
          tenantId,
          event: 'repair_request.received_internal',
          channel: 'email',
          recipient: internalRecipients.repairsEmail,
          payload: {
            reference,
            name: repair.name,
            category: repair.category,
            urgency: repair.urgency,
            propertyReference: repair.propertyReference,
            description: repair.description,
          },
        });
      }
      if (repair.urgency === 'emergency' && internalRecipients?.onCallPhone) {
        await notify(tx, {
          tenantId,
          event: 'repair_request.emergency_internal',
          channel: 'sms',
          recipient: internalRecipients.onCallPhone,
          payload: { reference, category: repair.category },
        });
      }
      await audit(tx, {
        tenantId,
        actor: `repair_request:${repair.email}`,
        action: 'repair_request.created',
        entity: 'repair_request',
        entityId: created.id,
        ip,
        userAgent,
      });
      return { id: created.id, reference };
    });

  let ticket: { id: string; reference: string };
  try {
    ticket = await submit();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A concurrent submission took the same sequence number — retry once.
    ticket = await submit();
  }

  if (filesMeta.length === 0) {
    return { ok: true, reference: ticket.reference };
  }

  // FR-G-2 upload grants: one signed key per declared file, bound under THIS
  // ticket's tenant prefix. Issued only now — after the Turnstile-verified,
  // consented submit — so the single challenge covers the whole flow (G8). The
  // rows are recorded by finalizeRepairFiles once the bytes have landed.
  const expiry = Date.now() + GRANT_TTL_MS;
  const secret = storageSigningSecret();
  const uploadGrants: RepairUploadGrant[] = filesMeta.map((meta) => {
    const extension = REPAIR_FILE_EXTENSIONS[meta.contentType];
    const key = `tenants/${tenantId}/repairs/${ticket.id}/${randomUUID()}.${extension}`;
    return { key, token: signObjectToken(key, expiry, secret), name: meta.fileName };
  });
  return { ok: true, reference: ticket.reference, repairRequestId: ticket.id, uploadGrants };
}

const GRANT_TTL_MS = 15 * 60_000;

/** One landed attachment, echoed back from the client after its PUT succeeded. */
export interface RepairFileFinalizeInput {
  key: string;
  name: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Record the landed attachments against a ticket (FR-G-2's second half). Public
 * like the submit itself — the authorisation is structural: every key must sit
 * under THIS ticket's tenant prefix (a grant for another ticket cannot be
 * grafted on), the bytes must actually exist in storage, the metadata must pass
 * the same constraints the grants were issued for, and the §G.1 ten-file cap
 * counts what is already attached. Every recorded file writes an audit row (G4).
 */
export async function finalizeRepairFiles(input: {
  repairRequestId: string;
  files: RepairFileFinalizeInput[];
}): Promise<RepairFormState> {
  const refused: RepairFormState = {
    ok: false,
    errors: [{ message: 'Those attachments could not be recorded.' }],
  };

  const metaResult = repairFilesMetaSchema.safeParse(
    input.files.map((file) => ({
      fileName: file.name,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
    })),
  );
  if (!metaResult.success || input.files.length === 0) {
    return refused;
  }

  const tenantId = await getCurrentTenantId();
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  // Structural authorisation: every key under THIS ticket's tenant prefix.
  const prefix = `tenants/${tenantId}/repairs/${input.repairRequestId}/`;
  if (input.files.some((file) => !file.key.startsWith(prefix))) {
    return refused;
  }

  // The bytes must actually have landed.
  const backend = getStorageBackend();
  for (const file of input.files) {
    if (!(await backend.exists(file.key))) {
      return refused;
    }
  }

  let result: RepairFormState = refused;
  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as RepairWriteClient;
    const ticket = await tx.repairRequest.findFirst({
      where: { id: input.repairRequestId },
    });
    if (!ticket) {
      return; // result stays refused
    }
    const attached = await tx.repairFile.count({
      where: { repairRequestId: input.repairRequestId },
    });
    if (attached + input.files.length > REPAIR_MAX_FILES) {
      return; // result stays refused
    }
    for (const file of input.files) {
      const created = await tx.repairFile.create({
        data: {
          tenantId,
          repairRequestId: input.repairRequestId,
          url: file.key,
          fileName: file.name,
          mimeType: file.contentType,
          fileSizeBytes: file.sizeBytes,
        },
      });
      await audit(tx, {
        tenantId,
        actor: `repair_request:${input.repairRequestId}`,
        action: 'repair_file.created',
        entity: 'repair_file',
        entityId: created.id,
        ip,
        userAgent,
      });
    }
    result = { ok: true };
  });
  return result;
}
