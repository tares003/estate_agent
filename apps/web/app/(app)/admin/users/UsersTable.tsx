import { Badge } from '@estate/ui';

import type { UserListResult } from '../../lib/users.js';

// EPIC-H user/role management (FR-H-15 list) — the staff directory table.
// Presentational + pure; token-driven (G7). Semantic table (`<th scope="col">`).
// The role is shown as a neutral Badge (it is an identity attribute, not a status).

function roleLabel(role: string): string {
  const spaced = role.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function pageHref(page: number): string {
  return page > 1 ? `/admin/users?page=${page}` : '/admin/users';
}

export function UsersTable({ result }: { result: UserListResult }) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0 ? 'No staff users' : `Showing ${items.length} of ${total} staff`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No staff users yet. Team members appear here once invited.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              {['Name', 'Email', 'Role'].map((heading) => (
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
            {items.map((user) => (
              <tr key={user.id} className="border-divider border-b">
                <td className="t-body-md py-3 pr-4">{user.name}</td>
                <td className="t-body-md py-3 pr-4">{user.email}</td>
                <td className="py-3">
                  <Badge tone="neutral">{roleLabel(user.role)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a className="t-body-md text-brand-primary" href={pageHref(page - 1)}>
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a className="t-body-md text-brand-primary" href={pageHref(page + 1)}>
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
