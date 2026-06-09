import Link from 'next/link';
import { Badge } from '@estate/ui';
import { ENQUIRY_STATUSES } from '@estate/validators';

import type { EnquiryQueueOptions, EnquiryQueueResult } from '../../lib/enquiries.js';
import { enquiryQueueQuery } from './queue-params.js';
import { ageBandDisplay, statusDisplay } from './status-display.js';

// EPIC-H enquiry queue (FR-H-3) — the lead queue table. Presentational + pure
// (the data + the parsed options are passed in); token-driven (G7). The filter is
// a server-rendered GET form (no JS — the URL is the single source of truth, and
// submitting drops `page` so it resets to page 1). The table is semantic
// (`<th scope="col">`) so every cell announces its column header.

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

function FilterBar({ options }: { options: EnquiryQueueOptions }) {
  return (
    <form
      method="get"
      className="mb-6 flex flex-wrap items-end gap-4"
      aria-label="Filter enquiries"
    >
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Status</span>
        <select
          name="status"
          defaultValue={options.status ?? ''}
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="">All open</option>
          {ENQUIRY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusDisplay(status).label}
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

export function EnquiryQueueTable({
  result,
  options,
}: {
  result: EnquiryQueueResult;
  options: EnquiryQueueOptions;
}) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar options={options} />

      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0
          ? 'No enquiries'
          : `Showing ${items.length} of ${total} enquir${total === 1 ? 'y' : 'ies'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No enquiries match this view. New enquiries from the public forms land here.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Name
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Email
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Status
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                Response
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = statusDisplay(item.status);
              const age = ageBandDisplay(item.ageBand);
              return (
                <tr key={item.id} className="border-divider border-b">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/enquiries/${item.id}`}
                      className="t-body-md text-brand-primary"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="t-body-md py-3 pr-4">{item.email}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="py-3">
                    <Badge tone={age.tone}>{age.label}</Badge>
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
              href={`/admin/enquiries${enquiryQueueQuery(options, page - 1)}`}
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
              href={`/admin/enquiries${enquiryQueueQuery(options, page + 1)}`}
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
