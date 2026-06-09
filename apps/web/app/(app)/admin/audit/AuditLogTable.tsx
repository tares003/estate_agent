import type { AuditLogOptions, AuditLogResult } from '../../lib/audit-log.js';
import { auditQuery } from './audit-params.js';

// EPIC-H audit-log viewer (FR-H-17) — the audit trail table. Presentational + pure;
// token-driven (G7). The filter is a server-rendered GET form (no JS — the URL is
// the single source of truth). The table is semantic (`<th scope="col">`). Every
// state-changing action shows its actor, target, full diff, IP and time.

const WHEN = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function formatDiff(diff: unknown): string {
  if (diff === null || diff === undefined) return '—';
  try {
    return JSON.stringify(diff);
  } catch {
    return '—';
  }
}

function FilterBar({ options }: { options: AuditLogOptions }) {
  return (
    <form
      method="get"
      className="mb-6 flex flex-wrap items-end gap-4"
      aria-label="Filter audit log"
    >
      <label className="flex flex-col gap-1">
        <span className="t-body-sm text-text-secondary">Entity</span>
        <input
          type="text"
          name="entity"
          defaultValue={options.entity ?? ''}
          placeholder="e.g. enquiry"
          className="border-divider rounded-md border px-3 py-2"
        />
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

export function AuditLogTable({
  result,
  options,
}: {
  result: AuditLogResult;
  options: AuditLogOptions;
}) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar options={options} />

      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0 ? 'No audit entries' : `Showing ${items.length} of ${total} entries`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No audit entries match this view. Every state-changing action is recorded here.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              {['When', 'Action', 'Actor', 'Target', 'IP', 'Change'].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="t-body-sm text-text-secondary py-2 pr-4 font-semibold"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.id} className="border-divider border-b align-top">
                <td className="t-body-sm py-3 pr-4 whitespace-nowrap">
                  {WHEN.format(entry.createdAt)}
                </td>
                <td className="t-body-sm py-3 pr-4 font-medium">{entry.action}</td>
                <td className="t-body-sm py-3 pr-4">{entry.actor}</td>
                <td className="t-body-sm py-3 pr-4">
                  {entry.entity}
                  {entry.entityId ? ` · ${entry.entityId}` : ''}
                </td>
                <td className="t-body-sm py-3 pr-4">{entry.ip ?? '—'}</td>
                <td className="py-3">
                  <code className="t-caption text-text-secondary break-all">
                    {formatDiff(entry.diff)}
                  </code>
                </td>
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
              href={`/admin/audit${auditQuery(options, page - 1)}`}
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
              href={`/admin/audit${auditQuery(options, page + 1)}`}
            >
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
