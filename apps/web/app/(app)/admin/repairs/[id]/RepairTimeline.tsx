import { Badge } from '@estate/ui';

import type { RepairStatusEventRow } from '../../../lib/repair-status-events.js';
import { repairStatusDisplay } from '../repair-display.js';

// EPIC-G repair detail (FR-G-7) — the ticket status-history timeline. Presentational
// + token-driven (G7). Each entry shows the transition (the prior status → the new
// status, as a label-led Badge — G9), any notes the actor recorded (e.g. the
// rejection reason or "parts on order"), and when it happened; newest-first from
// the read model. Fixed-locale date format so the output is deterministic in tests.

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function RepairTimeline({ events }: { events: RepairStatusEventRow[] }) {
  if (events.length === 0) {
    return <p className="t-body-sm text-text-secondary">No status changes yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const to = repairStatusDisplay(event.toStatus);
        return (
          <li key={event.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {event.fromStatus ? (
                <>
                  <span className="t-body-sm text-text-secondary">
                    {repairStatusDisplay(event.fromStatus).label}
                  </span>
                  <span aria-hidden="true" className="t-body-sm text-text-secondary">
                    →
                  </span>
                </>
              ) : null}
              <Badge tone={to.tone}>{to.label}</Badge>
              <span className="t-body-sm text-text-secondary">
                {EVENT_DATE.format(event.createdAt)}
              </span>
            </div>
            {event.notes ? <p className="t-body-sm max-w-[55ch]">{event.notes}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
