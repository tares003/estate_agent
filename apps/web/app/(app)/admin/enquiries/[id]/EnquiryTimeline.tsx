import { Badge } from '@estate/ui';

import type { EnquiryStatusEventRow } from '../../../lib/enquiry-status-events.js';
import { statusDisplay } from '../status-display.js';

// EPIC-H enquiry detail (FR-H-3) — the status activity timeline. Presentational +
// token-driven (G7). Each entry shows the transition (the prior status → the new
// status, as a Badge) and when it happened; newest-first from the read model.
// Fixed-locale date format so the output is deterministic across runtimes / tests.

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function EnquiryTimeline({ events }: { events: EnquiryStatusEventRow[] }) {
  if (events.length === 0) {
    return <p className="t-body-sm text-text-secondary">No status changes yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const to = statusDisplay(event.toStatus);
        return (
          <li key={event.id} className="flex flex-wrap items-center gap-2">
            {event.fromStatus ? (
              <>
                <span className="t-body-sm text-text-secondary">
                  {statusDisplay(event.fromStatus).label}
                </span>
                <span aria-hidden="true" className="t-body-sm text-text-secondary">
                  →
                </span>
              </>
            ) : null}
            <Badge tone={to.tone}>{to.label}</Badge>
            <span className="t-body-sm text-text-secondary">
              {EVENT_DATE.format(event.changedAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
