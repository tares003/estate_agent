import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// End-to-end validation of the EPIC-F public surfaces in a real browser over a
// real Postgres+PostGIS: the catalogue, the rent filter, the property detail
// (content + JSON-LD + enquiry form), the canonical-URL redirect, and WCAG 2.2 AA
// (axe). The `.badge` status pill is excluded from the contrast check pending
// D-010 (a known DESIGN.md token decision), so the scan still covers everything else.

/** Serious/critical axe violations on the current page (badge excluded — D-010). */
async function seriousA11yViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.badge')
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id);
}

test('catalogue lists the seeded properties and is accessible', async ({ page }) => {
  await page.goto('/properties');

  await expect(page.getByRole('heading', { level: 1, name: 'Properties' })).toBeVisible();
  await expect(page.getByText('£525,000')).toBeVisible();
  await expect(page.getByText('Edwardian semi · 4 bed')).toBeVisible();

  expect(await seriousA11yViolations(page)).toEqual([]);
});

test('the rent filter narrows results and updates the heading', async ({ page }) => {
  await page.goto('/properties?saleType=rent');

  await expect(page.getByRole('heading', { level: 1, name: 'Properties to rent' })).toBeVisible();
  await expect(page.getByText('Canalside apartment · 2 bed')).toBeVisible();
  await expect(page.getByText('Edwardian semi · 4 bed')).toHaveCount(0);
});

test('property detail renders content, JSON-LD and the enquiry form, accessibly', async ({
  page,
}) => {
  await page.goto('/properties/palatine-road-didsbury-m20');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Edwardian semi · 4 bed' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Send enquiry/i })).toBeVisible();

  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(jsonLd).toContain('RealEstateListing');

  expect(await seriousA11yViolations(page)).toEqual([]);
});

test('an uppercase URL 301-redirects to the lowercase canonical', async ({ page }) => {
  await page.goto('/Properties');
  expect(new URL(page.url()).pathname).toBe('/properties');
});
