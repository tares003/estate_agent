// responsive-coverage: opt-out all — asserts the page shell + metadata + the
// tenant-scoped category read; the form is covered by RepairForm.test.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({
  getRequestOrigin: async () => 'https://acme.test',
  getCurrentTenantId: async () => 'tenant-1',
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const categoryFindMany = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ repairCategory: { findMany: categoryFindMany } }),
}));

// The form is a client component (useActionState) — stub it so the page test
// focuses on the shell + the categories it passes down.
vi.mock('./RepairForm.js', () => ({
  RepairForm: ({ categories }: { categories: Array<{ value: string }> }) => (
    <div data-testid="repair-form">{categories.map((c) => c.value).join(',')}</div>
  ),
}));

const { default: ReportRepairPage, generateMetadata } = await import('./page.js');

describe('ReportRepairPage', () => {
  it('renders the heading + the form with the tenant categories', async () => {
    categoryFindMany.mockResolvedValue([{ slug: 'heating', label: 'Heating' }]);
    render(await ReportRepairPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Report a repair' })).toBeInTheDocument();
    expect(screen.getByTestId('repair-form')).toHaveTextContent('heating');
    expect(categoryFindMany).toHaveBeenCalledWith({
      where: { visible: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('falls back to the §G.3 defaults when the tenant has no categories', async () => {
    categoryFindMany.mockResolvedValue([]);
    render(await ReportRepairPage());
    expect(screen.getByTestId('repair-form')).toHaveTextContent('plumbing');
  });

  it('builds canonical metadata for the report-a-repair page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/report-a-repair');
    expect(meta.title).toBe('Report a repair');
  });
});
