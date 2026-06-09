import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';
import { canTransition } from '@estate/validators';

import { getDb } from '../../../lib/db.js';
import { listEnquiryNotes, type NoteListReader } from '../../../lib/enquiry-notes.js';
import {
  listEnquiryStatusEvents,
  type StatusEventReader,
} from '../../../lib/enquiry-status-events.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { statusDisplay } from '../status-display.js';
import { ConvertForm } from './ConvertForm.js';
import { EnquiryNotesThread } from './EnquiryNotesThread.js';
import { EnquiryTimeline } from './EnquiryTimeline.js';
import { nextStatusOptions } from './next-statuses.js';
import { NoteComposer } from './NoteComposer.js';
import { StatusChanger } from './StatusChanger.js';

// EPIC-H enquiry detail (FR-H-3) — a single enquiry: its summary, the status
// workflow control, and the note thread. Resolves the tenant, reads the enquiry +
// its notes inside the tenant RLS scope, and 404s an enquiry that isn't the
// tenant's. Thin composition over unit-tested pieces; renders inside the admin
// shell's `main` landmark.

export const dynamic = 'force-dynamic';

/** The enquiry columns the detail reads (no `leadType` — keeps the forbidden noun out, G6). */
interface EnquiryDetailRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  createdAt: Date;
}

interface EnquiryDetailClient {
  enquiry: {
    findFirst(args: { where: Record<string, unknown> }): Promise<EnquiryDetailRow | null>;
  };
  note: NoteListReader['note'];
  enquiryStatusEvent: StatusEventReader['enquiryStatusEvent'];
}

const RECEIVED = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const data = await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as EnquiryDetailClient;
    const enquiry = await tx.enquiry.findFirst({ where: { id } });
    if (!enquiry) return null;
    const [notes, events] = await Promise.all([
      listEnquiryNotes({ note: tx.note }, id, { includeInternal: true }),
      listEnquiryStatusEvents({ enquiryStatusEvent: tx.enquiryStatusEvent }, id),
    ]);
    return { enquiry, notes, events };
  });

  if (!data) notFound();
  const { enquiry, notes, events } = data;
  const status = statusDisplay(enquiry.status);

  return (
    <div className="flex max-w-[70ch] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/enquiries" className="t-body-sm text-brand-primary">
          ← Back to enquiries
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="t-display-sm">{enquiry.name}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <section aria-labelledby="summary-heading" className="flex flex-col gap-2">
        <h2 id="summary-heading" className="t-heading-sm">
          Summary
        </h2>
        <dl className="t-body-md grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
          <dt className="text-text-secondary">Email</dt>
          <dd>{enquiry.email}</dd>
          <dt className="text-text-secondary">Phone</dt>
          <dd>{enquiry.phone ?? '—'}</dd>
          <dt className="text-text-secondary">Received</dt>
          <dd>{RECEIVED.format(enquiry.createdAt)}</dd>
        </dl>
        <p className="t-body-md whitespace-pre-wrap">{enquiry.message}</p>
      </section>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="t-heading-sm">
          Status
        </h2>
        <StatusChanger enquiryId={enquiry.id} options={nextStatusOptions(enquiry.status)} />
      </section>

      {canTransition(enquiry.status, 'converted') ? (
        <section aria-labelledby="convert-heading" className="flex flex-col gap-3">
          <h2 id="convert-heading" className="t-heading-sm">
            Convert
          </h2>
          <ConvertForm enquiryId={enquiry.id} />
        </section>
      ) : null}

      <section aria-labelledby="notes-heading" className="flex flex-col gap-3">
        <h2 id="notes-heading" className="t-heading-sm">
          Notes
        </h2>
        <NoteComposer enquiryId={enquiry.id} />
        <EnquiryNotesThread notes={notes} />
      </section>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <h2 id="activity-heading" className="t-heading-sm">
          Activity
        </h2>
        <EnquiryTimeline events={events} />
      </section>
    </div>
  );
}
