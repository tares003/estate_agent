import { Badge } from '@estate/ui';

import type { PropertyStatusEventRow } from '../../../lib/property-status-events.js';
import { marketStatusLabel } from './market-status-display.js';

// EPIC-H property management (FR-H-2, master spec §J.3) — the market-status activity
// timeline on the listing detail. Presentational + token-driven (G7). Each entry
// shows the transition (the prior status → the new status, as a Badge) and when it
// happened; newest-first from the read model. The label is the primary signal, never
// colour alone (G9). Fixed-locale date format so the output is deterministic in tests.

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function PropertyTimeline({ events }: { events: PropertyStatusEventRow[] }) {
  if (events.length === 0) {
    return <p className="t-body-sm text-text-secondary">No status changes yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center gap-2">
          {event.fromStatus ? (
            <>
              <span className="t-body-sm text-text-secondary">
                {marketStatusLabel(event.fromStatus)}
              </span>
              <span aria-hidden="true" className="t-body-sm text-text-secondary">
                →
              </span>
            </>
          ) : null}
          <Badge tone="neutral">{marketStatusLabel(event.toStatus)}</Badge>
          <span className="t-body-sm text-text-secondary">
            {EVENT_DATE.format(event.changedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
