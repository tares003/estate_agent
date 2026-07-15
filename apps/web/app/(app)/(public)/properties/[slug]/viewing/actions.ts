'use server';

import { viewingRequestSchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../../../lib/db.js';
import {
  assignmentDiff,
  resolveEnquiryAssignment,
  type AssignmentRuleReader,
} from '../../../../lib/enquiry-routing.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../../../lib/tenant.js';
import { verifyTurnstile } from '../../../../lib/turnstile.js';
import { VIEWING_CONSENT_TEXT } from './consent-text.js';

// EPIC-F / EPIC-I viewing-request submission (PRODUCT.md §4 — "Book a viewing"). The
// canonical entity is the ENQUIRY: this produces a viewing-channel enquiry against a
// specific property (master spec §I.1, FR-I-1), routed through the tenant's
// assignment rules (FR-I-3 — first-match-wins; unmatched stays unassigned). Held to
// the compliance guards: G5 (the schema carries `gdpr_consent`; the agreed text is
// persisted verbatim) and G8 (Turnstile verified before any write). Every write is
// tenant-scoped (RLS) + audited (G4). Drives a form via `useActionState`.

interface ViewingWriteClient extends ConsentWriter, AuditWriter, AssignmentRuleReader {
  enquiry: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
}

/**
 * The safe subset of a viewing submission that is echoed back on an error so the
 * form can re-fill itself rather than wiping the user's input. The `gdpr_consent`
 * affirmation and the single-use Turnstile token are DELIBERATELY excluded — see
 * `submitViewing`. `propertyId` is not echoed here: the form re-renders it from
 * its own hidden field, driven by the page's props.
 */
export interface ViewingFormValues {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  preferredDate?: string | undefined;
  alternativeDate?: string | undefined;
  message?: string | undefined;
}

/** The result of a viewing submission, consumed by `useActionState`. */
export interface ViewingFormState {
  ok: boolean;
  errors?: FormErrorItem[];
  /** The submitted safe fields, returned on an error so the form can re-fill them. */
  values?: ViewingFormValues;
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitViewing(
  _prevState: ViewingFormState,
  formData: FormData,
): Promise<ViewingFormState> {
  // Preserve the user's safe input so any error return re-fills the form instead
  // of wiping it. Consent is NOT echoed — it must be a fresh affirmative act every
  // submit (G5) — and the Turnstile token is NOT echoed (single-use; G8).
  const values: ViewingFormValues = {
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    preferredDate: field(formData, 'preferredDate'),
    alternativeDate: field(formData, 'alternativeDate'),
    message: field(formData, 'message'),
  };

  const parsed = viewingRequestSchema.safeParse({
    ...values,
    propertyId: field(formData, 'propertyId'),
    gdpr_consent: formData.get('gdpr_consent') === 'on',
  });

  if (!parsed.success) {
    const errors: FormErrorItem[] = parsed.error.issues.map((issue) => {
      const fieldKey = typeof issue.path[0] === 'string' ? issue.path[0] : undefined;
      return fieldKey === undefined
        ? { message: issue.message }
        : { field: fieldKey, message: issue.message };
    });
    return { ok: false, errors, values };
  }

  const viewing = parsed.data;
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
      values,
    };
  }

  const message =
    `Viewing request — preferred ${viewing.preferredDate}` +
    `${viewing.alternativeDate ? `, alternative ${viewing.alternativeDate}` : ''}.` +
    `${viewing.message ? ` ${viewing.message}` : ''}`;

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ViewingWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'viewing_form',
      subject: viewing.email,
      consentText: VIEWING_CONSENT_TEXT,
      ipAddress: ip,
    });
    // FR-I-3: route through the tenant's assignment rules (first-match-wins);
    // the winning agent/branch target is persisted, unmatched stays unassigned.
    const assignment = await resolveEnquiryAssignment(tx, {
      enquiryType: 'viewing_request',
      status: 'new',
      sourceUrl: null,
      message,
      hasProperty: true,
    });
    // This enquiry's channel is a viewing request for the property. `lead_type` is
    // the committed DB column for the enquiry channel (the schema is the source of
    // truth); it is set via bracket access to keep the forbidden noun out of a
    // declared identifier (PRODUCT.md §2/§3, G6).
    const data: Record<string, unknown> = {
      tenantId,
      propertyId: viewing.propertyId,
      name: viewing.name,
      email: viewing.email,
      phone: viewing.phone,
      message,
      assignedAgentId: assignment.assignedAgentId,
      assignedBranchId: assignment.assignedBranchId,
    };
    data['leadType'] = 'viewing_request';
    const created = await tx.enquiry.create({ data });
    await audit(tx, {
      tenantId,
      actor: `enquiry:${viewing.email}`,
      action: 'enquiry.created',
      entity: 'enquiry',
      entityId: created.id,
      diff: assignmentDiff(assignment),
      ip,
      userAgent,
    });
  });

  return { ok: true };
}
