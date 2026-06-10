import { Badge } from '@estate/ui';

import type { RepairRow } from '../../lib/repairs.js';
import { repairStatusDisplay, repairUrgencyDisplay } from './repair-display.js';

// EPIC-G repairs inbox (FR-G-2) — the triage table. Presentational + pure (the rows
// are passed in); token-driven (G7). Semantic table (`<th scope="col">`) so every
// cell announces its column header (G9). Urgency + status are conveyed by the badge
// label, never by colour alone (G9). The row is read-only for now — triage (resolve
// the property, assign a contractor) is a later slice with its own detail route.

const SUBMITTED = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function RepairsInboxTable({ repairs }: { repairs: RepairRow[] }) {
  if (repairs.length === 0) {
    return (
      <p className="t-body-lg text-text-secondary max-w-[55ch]">
        No repairs reported yet. Reports from the tenant repair form land here.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-divider border-b">
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Reporter
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Property
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Category
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Urgency
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
            Status
          </th>
          <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
            Submitted
          </th>
        </tr>
      </thead>
      <tbody>
        {repairs.map((repair) => {
          const urgency = repairUrgencyDisplay(repair.urgency);
          const status = repairStatusDisplay(repair.status);
          return (
            <tr key={repair.id} className="border-divider border-b">
              <td className="t-body-md py-3 pr-4">{repair.name}</td>
              <td className="t-body-md py-3 pr-4">{repair.reference ?? '—'}</td>
              <td className="t-body-md py-3 pr-4">{repair.category}</td>
              <td className="py-3 pr-4">
                <Badge tone={urgency.tone}>{urgency.label}</Badge>
              </td>
              <td className="py-3 pr-4">
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td className="t-body-sm text-text-secondary py-3">
                {SUBMITTED.format(repair.createdAt)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
