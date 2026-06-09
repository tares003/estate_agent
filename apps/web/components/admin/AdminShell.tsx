import type { ReactNode } from 'react';

import { AdminSidebar } from './AdminSidebar.js';

// EPIC-H admin shell — the chrome every admin surface renders inside: the primary
// navigation rail, a topbar (page title + the signed-in account), and the content
// region that owns the `main` landmark (the (app) skip-link targets `#main`).
// Pure + props-driven + token-driven (G7). The rail stacks above the content below
// the `md` breakpoint (full collapsing-drawer behaviour is a follow-up).

export function AdminShell({
  currentPath,
  accountLabel,
  title,
  children,
}: {
  currentPath: string | null;
  accountLabel: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface-base text-text-primary flex min-h-screen flex-col md:flex-row">
      <aside className="md:w-60 md:shrink-0">
        <AdminSidebar currentPath={currentPath} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-divider flex h-14 items-center justify-between border-b px-6">
          <span className="t-heading-sm font-semibold">{title ?? 'Admin'}</span>
          <span className="t-body-sm text-text-secondary">{accountLabel}</span>
        </header>
        <main id="main" className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
