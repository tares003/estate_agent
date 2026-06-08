import { describe, it, expect } from 'vitest';
import { BREAKPOINTS, checkResponsiveCoverage } from './g11-responsive-coverage.js';

// G11 — Responsive-coverage guard. Per design-requirements.md §3, every visual
// regression / component test must assert layout at each canonical breakpoint
// (the seven widths in responsive-coverage.json). A test may explicitly opt a
// breakpoint out with a `responsive-coverage: opt-out <width...>` marker (or
// `opt-out all`), which records intent rather than silently skipping coverage.
//
// These tests use deterministic inline fixtures — no filesystem, no network.
describe('G11 responsive-coverage guard', () => {
  it('exposes the seven canonical breakpoints in ascending order', () => {
    expect(BREAKPOINTS).toEqual([320, 640, 768, 1024, 1280, 1440, 2560]);
  });

  it('CLEAN: a test asserting all seven breakpoints passes', () => {
    // Property catalogue gallery rendered across the full breakpoint set.
    const source = `
      import { test } from '@playwright/test';
      for (const width of [320, 640, 768, 1024, 1280, 1440, 2560]) {
        test('property gallery @ ' + width, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto('/properties');
        });
      }
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.asserted).toEqual([320, 640, 768, 1024, 1280, 1440, 2560]);
    expect(result.optedOut).toEqual([]);
  });

  it('VIOLATION: a test asserting only 320/768/1280 with no opt-out is rejected', () => {
    // Deliberate-violation fixture: the fail-closed proof.
    const source = `
      import { test } from '@playwright/test';
      test('property detail @ 320', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
      });
      test('property detail @ 768', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 800 });
      });
      test('property detail @ 1280', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
      });
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.ok).toBe(false);
    expect(result.asserted).toEqual([320, 768, 1280]);
    expect(result.missing).toEqual([640, 1024, 1440, 2560]);
    expect(result.optedOut).toEqual([]);
  });

  it('opting the remaining breakpoints out on one marker line restores coverage', () => {
    const source = `
      import { test } from '@playwright/test';
      // responsive-coverage: opt-out 640 1024 1440 2560
      // (this component is fixed-width below 1024 per the EPIC-F design brief)
      test('property detail @ 320', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
      });
      test('property detail @ 768', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 800 });
      });
      test('property detail @ 1280', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
      });
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.asserted).toEqual([320, 768, 1280]);
    expect(result.optedOut).toEqual([640, 1024, 1440, 2560]);
  });

  it('`opt-out all` with no asserted widths passes', () => {
    const source = `
      import { test } from '@playwright/test';
      // responsive-coverage: opt-out all
      // (audit-log assertion only; no viewport-dependent layout)
      test('enquiry audit-log row emitted', async ({ page }) => {
        await page.goto('/admin/enquiries');
      });
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.asserted).toEqual([]);
    expect(result.optedOut).toEqual([320, 640, 768, 1024, 1280, 1440, 2560]);
  });

  it('only opts out the breakpoints named on the marker line, not unrelated widths', () => {
    // The marker line names 640 only; 1024/1440/2560 stay missing.
    const source = `
      // responsive-coverage: opt-out 640
      const widths = [320, 768, 1280];
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.asserted).toEqual([320, 768, 1280]);
    expect(result.optedOut).toEqual([640]);
    expect(result.missing).toEqual([1024, 1440, 2560]);
    expect(result.ok).toBe(false);
  });

  it('a width on the opt-out marker line is not also counted as asserted', () => {
    // 640 appears only on the marker line -> opted out, not asserted.
    const source = `
      // responsive-coverage: opt-out 640
      const widths = [320, 768, 1024, 1280, 1440, 2560];
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.asserted).toEqual([320, 768, 1024, 1280, 1440, 2560]);
    expect(result.optedOut).toEqual([640]);
    expect(result.missing).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('ignores numbers that are not canonical breakpoints', () => {
    const source = `
      await page.setViewportSize({ width: 375, height: 812 });
      const ratio = 1536;
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.asserted).toEqual([]);
    expect(result.missing).toEqual([320, 640, 768, 1024, 1280, 1440, 2560]);
    expect(result.ok).toBe(false);
  });

  it('does not match a breakpoint number embedded in a larger number', () => {
    // 3201, 25600 must not satisfy 320 / 2560.
    const source = `
      const a = 3201;
      const b = 25600;
      const c = 76800;
    `;
    const result = checkResponsiveCoverage(source);
    expect(result.asserted).toEqual([]);
    expect(result.ok).toBe(false);
  });
});
