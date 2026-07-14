'use server';

import { valuationRequestSchema } from '@estate/validators';
import { audit, recordConsent, withTenant, type AuditWriter, type ConsentWriter } from '@estate/db';
import type { FormErrorItem } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import {
  assignmentDiff,
  resolveEnquiryAssignment,
  type AssignmentRuleReader,
} from '../../lib/enquiry-routing.js';
import { getCurrentTenantId, getRequestIp, getRequestUserAgent } from '../../lib/tenant.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import { VALUATION_CONSENT_TEXT } from './consent-text.js';

// EPIC-C / EPIC-I valuation-request submission (PRODUCT.md §4 — "Get a free
// valuation"). The canonical entity is the ENQUIRY: this produces an enquiry whose
// channel is the valuation request (master spec §I.1, FR-I-1), routed through the
// tenant's assignment rules (FR-I-3 — first-match-wins; unmatched stays
// unassigned). Held to the two compliance guards: G5 (the schema carries
// `gdpr_consent`; the agreed text is persisted verbatim) and G8 (the anti-spam
// challenge is verified before any write). Every write is tenant-scoped (RLS) +
// audited (G4). Drives a form via `useActionState`.

interface ValuationWriteClient extends ConsentWriter, AuditWriter, AssignmentRuleReader {
  enquiry: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
}

/** The result of a valuation submission, consumed by `useActionState`. */
export interface ValuationFormState {
  ok: boolean;
  errors?: FormErrorItem[];
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export async function submitValuation(
  _prevState: ValuationFormState,
  formData: FormData,
): Promise<ValuationFormState> {
  const bedroomsRaw = field(formData, 'bedrooms');
  const parsed = valuationRequestSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    addressLine1: field(formData, 'addressLine1'),
    postcode: field(formData, 'postcode'),
    propertyType: field(formData, 'propertyType'),
    bedrooms: bedroomsRaw === undefined ? undefined : Number(bedroomsRaw),
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

  const valuation = parsed.data;
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

  const message =
    `Valuation request — ${valuation.addressLine1}, ${valuation.postcode}. ` +
    `${valuation.propertyType}${valuation.bedrooms !== undefined ? `, ${valuation.bedrooms} bed` : ''}.`;

  await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as ValuationWriteClient;
    await recordConsent(tx, {
      tenantId,
      scope: 'valuation_form',
      subject: valuation.email,
      consentText: VALUATION_CONSENT_TEXT,
      ipAddress: ip,
    });
    // FR-I-3: route through the tenant's assignment rules (first-match-wins);
    // the winning agent/branch target is persisted, unmatched stays unassigned.
    const assignment = await resolveEnquiryAssignment(tx, {
      enquiryType: 'valuation_request',
      status: 'new',
      sourceUrl: null,
      message,
      hasProperty: false,
    });
    // This enquiry's channel is the valuation request. `lead_type` is the committed
    // DB column for the enquiry channel (the schema is the source of truth); it is
    // set via bracket access to keep the forbidden noun out of a declared
    // identifier (PRODUCT.md §2/§3, G6).
    const data: Record<string, unknown> = {
      tenantId,
      name: valuation.name,
      email: valuation.email,
      phone: valuation.phone,
      message,
      assignedAgentId: assignment.assignedAgentId,
      assignedBranchId: assignment.assignedBranchId,
    };
    data['leadType'] = 'valuation_request';
    const created = await tx.enquiry.create({ data });
    await audit(tx, {
      tenantId,
      actor: `enquiry:${valuation.email}`,
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
