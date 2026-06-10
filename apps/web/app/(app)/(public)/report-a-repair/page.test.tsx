// responsive-coverage: opt-out all — asserts the page shell + metadata; the form
// is covered by RepairForm.test, and responsive layout by the Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));
// The form is a client component (useActionState) — stub it so the page test
// focuses on the shell.
vi.mock('./RepairForm.js', () => ({
  RepairForm: () => <div data-testid="repair-form" />,
}));

const { default: ReportRepairPage, generateMetadata } = await import('./page.js');

describe('ReportRepairPage', () => {
  it('renders the heading + the repair form', () => {
    render(<ReportRepairPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Report a repair' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('repair-form')).toBeInTheDocument();
  });

  it('builds canonical metadata for the report-a-repair page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/report-a-repair');
    expect(meta.title).toBe('Report a repair');
  });
});
