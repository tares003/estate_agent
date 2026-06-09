import { Badge } from '@estate/ui';
import { CONTACT_TYPES } from '@estate/validators';

import type { ContactListOptions, ContactListResult } from '../../lib/contacts.js';
import { contactListQuery } from './contacts-params.js';

// EPIC-H contacts (FR-H-7) — the contact directory table. Presentational + pure;
// token-driven (G7). The filter is a server-rendered GET form (no JS — the URL is
// the single source of truth). The table is semantic (`<th scope="col">`) so every
// cell announces its column header. The party type is a label, not an urgency, so
// its Badge is neutral.

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function FilterBar({ options }: { options: ContactListOptions }) {
  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-4" aria-label="Filter contacts">
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Type</span>
        <select
          name="type"
          defaultValue={options.type ?? ''}
          className="border-divider rounded-md border px-3 py-2"
        >
          <option value="">All types</option>
          {CONTACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
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

export function ContactsTable({
  result,
  options,
}: {
  result: ContactListResult;
  options: ContactListOptions;
}) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar options={options} />

      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0
          ? 'No contacts'
          : `Showing ${items.length} of ${total} contact${total === 1 ? '' : 's'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No contacts match this view. Converting an enquiry creates a contact here.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Name
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Type
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 pr-4 font-semibold">
                Email
              </th>
              <th scope="col" className="t-body-sm text-text-secondary py-2 font-semibold">
                Phone
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((contact) => (
              <tr key={contact.id} className="border-divider border-b">
                <td className="t-body-md py-3 pr-4">{contact.name}</td>
                <td className="py-3 pr-4">
                  <Badge tone="neutral">{titleCase(contact.type)}</Badge>
                </td>
                <td className="t-body-md py-3 pr-4">{contact.email ?? '—'}</td>
                <td className="t-body-md py-3">{contact.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a
              className="t-body-md text-brand-primary"
              href={`/admin/contacts${contactListQuery(options, page - 1)}`}
            >
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a
              className="t-body-md text-brand-primary"
              href={`/admin/contacts${contactListQuery(options, page + 1)}`}
            >
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
