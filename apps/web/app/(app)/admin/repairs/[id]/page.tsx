import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getDb } from '../../../lib/db.js';
import {
  listRepairStatusEvents,
  type RepairEventReader,
} from '../../../lib/repair-status-events.js';
import { getRepairRequest, type RepairDetailReader } from '../../../lib/repairs.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { repairStatusDisplay, repairUrgencyDisplay } from '../repair-display.js';
import { nextRepairStatusOptions } from './next-statuses.js';
import { RepairStatusControl } from './RepairStatusControl.js';
import { RepairTimeline } from './RepairTimeline.js';

// EPIC-G repair triage detail (master spec §G.2/§G.5, FR-G-6/FR-G-7). Resolves the
// tenant, reads the ticket + its status history in the same tenant (RLS) scope
// (404 if unknown), and renders: the header context (reporter, urgency + status
// badges, category, property reference, submitted), the issue description, the
// reporter's contact details, the §G.5 status changer (only legal next statuses),
// and the status-history timeline. Renders inside the admin shell's `main`
// landmark.

export const dynamic = 'force-dynamic';

const SUBMITTED = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function RepairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const data = await withTenant(getDb(), tenantId, async (tx) => {
    const repair = await getRepairRequest(tx as unknown as RepairDetailReader, id);
    if (!repair) return null;
    const events = await listRepairStatusEvents(tx as unknown as RepairEventReader, id);
    return { repair, events };
  });

  if (!data) notFound();

  const { repair, events } = data;
  const urgency = repairUrgencyDisplay(repair.urgency);
  const status = repairStatusDisplay(repair.status);

  return (
    <div className="flex max-w-[70ch] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/repairs" className="t-body-sm text-brand-primary">
          ← Back to repairs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-display-sm">Repair — {repair.name}</h1>
          <Badge tone={urgency.tone}>{urgency.label}</Badge>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="t-body-sm text-text-secondary">
          {repair.category} · Submitted {SUBMITTED.format(repair.createdAt)}
        </p>
      </div>

      <section aria-labelledby="issue-heading" className="flex flex-col gap-3">
        <h2 id="issue-heading" className="t-heading-sm">
          The issue
        </h2>
        <p className="t-body-md max-w-[60ch]">{repair.description}</p>
        {repair.rejectedReason ? (
          <p className="t-body-sm text-text-secondary max-w-[60ch]">
            Rejection reason: {repair.rejectedReason}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="reporter-heading" className="flex flex-col gap-3">
        <h2 id="reporter-heading" className="t-heading-sm">
          Reporter
        </h2>
        <dl className="flex flex-col gap-1">
          <div className="flex gap-2">
            <dt className="t-body-sm text-text-secondary w-24">Property</dt>
            <dd className="t-body-sm">{repair.reference ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="t-body-sm text-text-secondary w-24">Email</dt>
            <dd className="t-body-sm">{repair.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="t-body-sm text-text-secondary w-24">Phone</dt>
            <dd className="t-body-sm">{repair.phone ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="triage-heading" className="flex flex-col gap-3">
        <h2 id="triage-heading" className="t-heading-sm">
          Update status
        </h2>
        <RepairStatusControl
          repairId={repair.id}
          options={nextRepairStatusOptions(repair.status)}
        />
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="t-heading-sm">
          Status history
        </h2>
        <RepairTimeline events={events} />
      </section>
    </div>
  );
}
