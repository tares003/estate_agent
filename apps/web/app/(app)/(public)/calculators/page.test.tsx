// responsive-coverage: opt-out all — asserts the hub shell + metadata + links;
// responsive layout is the page-level Playwright pass (design-requirements §3).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getRequestOrigin: async () => 'https://acme.test' }));

const { default: CalculatorsPage, generateMetadata } = await import('./page.js');

describe('CalculatorsPage (hub)', () => {
  it('links to both calculators', () => {
    render(<CalculatorsPage />);
    expect(screen.getByRole('link', { name: /mortgage/i }).getAttribute('href')).toBe(
      '/calculators/mortgage',
    );
    expect(screen.getByRole('link', { name: /stamp duty/i }).getAttribute('href')).toBe(
      '/calculators/stamp-duty',
    );
  });

  it('builds canonical metadata for the calculators hub', async () => {
    const meta = await generateMetadata();
    expect(meta.alternates?.canonical).toBe('https://acme.test/calculators');
    expect(meta.title).toMatch(/calculator/i);
  });
});
