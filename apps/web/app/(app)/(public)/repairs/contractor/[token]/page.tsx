import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { contractorLinkSecret, verifyContractorLink } from '../../../../lib/contractor-access.js';
import { contractorNextStep } from '../../../../lib/contractor-portal.js';
import { getDb } from '../../../../lib/db.js';
import { getRepairRequest, type RepairDetailReader } from '../../../../lib/repairs.js';
import {
  repairStatusDisplay,
  repairUrgencyDisplay,
} from '../../../../admin/repairs/repair-display.js';
import { getCurrentTenantId } from '../../../../lib/tenant.js';
import { ContractorAdvanceControl } from './ContractorAdvanceControl.js';

// EPIC-G contractor portal (FR-G-8) — the no-sign-in ticket view a contractor
// opens from their emailed magic-link. The token IS the authorisation: it is
// verified before any DB read; the ticket is loaded inside the tenant (RLS) scope
// resolved from the request host; and the token's contractor MUST be the ticket's
// CURRENT assignee (a reassigned ticket invalidates the old link). A bad / expired
// / mismatched link is a 404 (it reveals nothing). The view is deliberately
// CURATED — the work facts the contractor needs (reference, category, urgency,
// description, the property to attend) — and omits the reporter's contact details
// and the internal status-history notes (FR-G-8 "excluding internal notes").

export const dynamic = 'force-dynamic';

export default async function ContractorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyContractorLink(token, contractorLinkSecret(), Date.now());
  if (verified === null) {
    notFound();
  }

  const tenantId = await getCurrentTenantId();
  const ticket = await withTenant(getDb(), tenantId, (tx) =>
    getRepairRequest(tx as unknown as RepairDetailReader, verified.repairRequestId),
  );
  // The link must be for this ticket's CURRENT assignee — nothing leaks otherwise.
  if (!ticket || ticket.assignedContractorId !== verified.contractorId) {
    notFound();
  }

  const urgency = repairUrgencyDisplay(ticket.urgency);
  const status = repairStatusDisplay(ticket.status);
  const step = contractorNextStep(ticket.status);

  return (
    <main id="main" className="container py-12">
      <div className="flex max-w-[60ch] flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-display-sm">Repair {ticket.reference ?? ''}</h1>
            <Badge tone={urgency.tone}>{urgency.label}</Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="t-body-sm text-text-secondary">{ticket.category}</p>
        </div>

        <section aria-labelledby="where-heading" className="flex flex-col gap-2">
          <h2 id="where-heading" className="t-heading-sm">
            Where
          </h2>
          <p className="t-body-md">{ticket.propertyReference ?? 'Address to be confirmed'}</p>
        </section>

        <section aria-labelledby="what-heading" className="flex flex-col gap-2">
          <h2 id="what-heading" className="t-heading-sm">
            The job
          </h2>
          <p className="t-body-md whitespace-pre-line">{ticket.description}</p>
        </section>

        <section aria-labelledby="action-heading" className="flex flex-col gap-3">
          <h2 id="action-heading" className="t-heading-sm">
            Update
          </h2>
          {step ? (
            <ContractorAdvanceControl token={token} label={step.label} />
          ) : (
            <p className="t-body-md text-text-secondary">
              Thanks — this repair has been submitted for review. There’s nothing more to do here
              for now.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
