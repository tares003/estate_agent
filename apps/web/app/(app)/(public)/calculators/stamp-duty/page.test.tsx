// responsive-coverage: opt-out all — asserts the page shell + metadata; the
// calculator is covered by StampDutyCalculator.test, responsive by Playwright.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/tenant.js', () => ({
  getRequestOrigin: async () => 'https://acme.test',
  getCurrentTenantId: async () => '00000000-0000-0000-0000-000000000001',
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) => fn({}),
}));
const loadSdltConfig = vi.fn(async () => ({ standardBands: [], lastUpdated: '2024-04-01' }));
vi.mock('../../../lib/sdlt-config.js', () => ({ loadSdltConfig: () => loadSdltConfig() }));
vi.mock('./StampDutyCalculator.js', () => ({
  StampDutyCalculator: () => <div data-testid="stamp-duty-calculator" />,
}));

const { default: StampDutyCalculatorPage, generateMetadata } = await import('./page.js');

describe('StampDutyCalculatorPage', () => {
  it('renders the heading + the calculator', async () => {
    render(await StampDutyCalculatorPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Stamp duty calculator' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('stamp-duty-calculator')).toBeInTheDocument();
    expect(loadSdltConfig).toHaveBeenCalled();
  });

  it('builds canonical metadata for the calculator page', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/calculators/stamp-duty');
    expect(meta.title).toBe('Stamp duty calculator');
  });
});
