import Link from 'next/link';
import { Badge } from '@estate/ui';
import { REPAIR_STATUSES } from '@estate/validators';

import type { RepairQueueOptions, RepairQueueResult } from '../../lib/repairs.js';
import { repairQueueQuery } from './queue-params.js';
import { repairStatusDisplay, repairUrgencyDisplay, slaRiskDisplay } from './repair-display.js';

// EPIC-G repairs inbox (FR-G-2/FR-G-9) — the triage table. Presentational + pure
// (the data + the parsed options are passed in); token-driven (G7). The filter is a
// server-rendered GET form (no JS — the URL is the single source of truth, and
// submitting drops `page` so it resets to page 1). Semantic table
// (`<th scope="col">`) so every cell announces its column header (G9). Urgency,
// status and SLA risk are conveyed by the badge label, never by colour alone (G9).
// The reporter links through to the ticket's triage detail.

const URGENCY_FILTER_OPTIONS = ['emergency', 'urgent', 'standard', 'low'] as const;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

const SUBMITTED = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function FilterBar({ options }: { options: RepairQueueOptions }) {
  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-4" aria-label="Filter repairs">
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Status</span>
        <select
          name="status"
          defaultValue={options.status ?? ''}
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="">All open</option>
          {REPAIR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {repairStatusDisplay(status).label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Urgency</span>
        <select
          name="urgency"
          defaultValue={options.urgency ?? ''}
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="">Any</option>
          {URGENCY_FILTER_OPTIONS.map((urgency) => (
            <option key={urgency} value={urgency}>
              {repairUrgencyDisplay(urgency).label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Sort</span>
        <select
          name="sort"
          defaultValue={options.sort ?? 'newest'}
          className="border-divider rounded-md border px-3 py-2"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="t-body-md text-brand-primary border-brand-primary rounded-md border px-4 py-2"
      >
        Apply
      </button>
    </form>
  );
}

export function RepairsInboxTable({
  result,
  options,
}: {
  result: RepairQueueResult;
  options: RepairQueueOptions;
}) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar options={options} />

      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0
          ? 'No repairs'
          : `Showing ${items.length} of ${total} repair${total === 1 ? '' : 's'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No repairs match this view. Reports from the tenant repair form land here.
        </p>
      ) : (
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
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                SLA
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((repair) => {
              const urgency = repairUrgencyDisplay(repair.urgency);
              const status = repairStatusDisplay(repair.status);
              const risk = repair.slaRisk === null ? null : slaRiskDisplay(repair.slaRisk);
              return (
                <tr key={repair.id} className="border-divider border-b">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/repairs/${repair.id}`}
                      className="t-body-md text-brand-primary"
                    >
                      {repair.name}
                    </Link>
                  </td>
                  <td className="t-body-md py-3 pr-4">{repair.reference ?? '—'}</td>
                  <td className="t-body-md py-3 pr-4">{repair.category}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={urgency.tone}>{urgency.label}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {risk ? <Badge tone={risk.tone}>{risk.label}</Badge> : '—'}
                  </td>
                  <td className="t-body-sm text-text-secondary py-3">
                    {SUBMITTED.format(repair.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link
              className="t-body-md text-brand-primary"
              href={`/admin/repairs${repairQueueQuery(options, page - 1)}`}
            >
              ← Previous
            </Link>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              className="t-body-md text-brand-primary"
              href={`/admin/repairs${repairQueueQuery(options, page + 1)}`}
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
