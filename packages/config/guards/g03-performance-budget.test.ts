import { describe, it, expect } from 'vitest';
import {
  ROUTE_BUDGETS,
  CORE_WEB_VITALS,
  classifyRoute,
  checkBundleBudget,
} from './g03-performance-budget.js';

// G3 — Performance-budget guard (budget-evaluation core).
//
// These tests pin the budget table, the Core Web Vitals thresholds, the route
// classifier, and the bundle-budget checker against design-requirements.md §3.
// The full Lighthouse / production-build measurement that FEEDS this checker is
// wired as a separate CI job later; this file proves the pure evaluation logic.
describe('G3 performance-budget core', () => {
  it('ROUTE_BUDGETS matches design-requirements.md §3 (gzipped KB)', () => {
    expect(ROUTE_BUDGETS).toEqual({
      marketing: { js: 150, css: 50 },
      catalogue: { js: 200, css: 60 },
      detail: { js: 220, css: 60 },
      admin: { js: 350 },
      customer: { js: 200 },
    });
  });

  it('CORE_WEB_VITALS matches the §3 75th-percentile thresholds', () => {
    expect(CORE_WEB_VITALS).toEqual({ lcpSeconds: 2.5, inpMs: 200, cls: 0.1 });
  });

  describe('classifyRoute', () => {
    it('classifies the catalogue listing route', () => {
      expect(classifyRoute('/properties')).toBe('catalogue');
      expect(classifyRoute('/properties/')).toBe('catalogue');
    });

    it('classifies a single property detail route', () => {
      expect(classifyRoute('/properties/abc-123')).toBe('detail');
    });

    it('classifies the admin shell', () => {
      expect(classifyRoute('/admin')).toBe('admin');
      expect(classifyRoute('/admin/properties')).toBe('admin');
    });

    it('classifies the customer account area', () => {
      expect(classifyRoute('/account')).toBe('customer');
      expect(classifyRoute('/account/viewings')).toBe('customer');
    });

    it('falls back to marketing for everything else', () => {
      expect(classifyRoute('/')).toBe('marketing');
      expect(classifyRoute('/about')).toBe('marketing');
      expect(classifyRoute('/contact')).toBe('marketing');
    });
  });

  describe('checkBundleBudget', () => {
    // DELIBERATE VIOLATION — marketing home over the 150 KB JS budget.
    it('REJECTS a marketing route over the JS budget', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 180, cssKb: 40 }]);
      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        { route: '/', budget: 'marketing', metric: 'js', actualKb: 180, limitKb: 150 },
      ]);
    });

    // CLEAN — marketing home under both budgets.
    it('PASSES a marketing route under both budgets', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 140, cssKb: 40 }]);
      expect(result).toEqual({ ok: true, violations: [] });
    });

    // CLEAN — catalogue under the wider 200/60 budget.
    it('PASSES a catalogue route under the 200/60 budget', () => {
      const result = checkBundleBudget([{ route: '/properties', jsKb: 190, cssKb: 55 }]);
      expect(result).toEqual({ ok: true, violations: [] });
    });

    // DELIBERATE VIOLATION — admin shell over the 350 KB JS budget.
    it('REJECTS an admin route over the JS budget', () => {
      const result = checkBundleBudget([{ route: '/admin', jsKb: 360 }]);
      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        { route: '/admin', budget: 'admin', metric: 'js', actualKb: 360, limitKb: 350 },
      ]);
    });

    it('flags a CSS overage on a route that has a CSS limit', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 140, cssKb: 70 }]);
      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        { route: '/', budget: 'marketing', metric: 'css', actualKb: 70, limitKb: 50 },
      ]);
    });

    it('reports both JS and CSS overages on the same route', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 200, cssKb: 80 }]);
      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        { route: '/', budget: 'marketing', metric: 'js', actualKb: 200, limitKb: 150 },
        { route: '/', budget: 'marketing', metric: 'css', actualKb: 80, limitKb: 50 },
      ]);
    });

    it('ignores CSS on budgets with no CSS limit (admin, customer)', () => {
      // A huge CSS payload on the admin shell is not measured here because §3
      // sets no admin CSS budget; only the JS budget governs the admin shell.
      const result = checkBundleBudget([
        { route: '/admin', jsKb: 300, cssKb: 999 },
        { route: '/account', jsKb: 190, cssKb: 999 },
      ]);
      expect(result).toEqual({ ok: true, violations: [] });
    });

    it('treats a route at exactly the limit as within budget', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 150, cssKb: 50 }]);
      expect(result).toEqual({ ok: true, violations: [] });
    });

    it('treats a missing cssKb as no CSS to measure', () => {
      const result = checkBundleBudget([{ route: '/', jsKb: 140 }]);
      expect(result).toEqual({ ok: true, violations: [] });
    });

    it('aggregates violations across multiple routes', () => {
      const result = checkBundleBudget([
        { route: '/', jsKb: 140, cssKb: 40 }, // clean
        { route: '/properties', jsKb: 210, cssKb: 55 }, // js over catalogue 200
        { route: '/properties/xyz', jsKb: 100, cssKb: 70 }, // css over detail 60
      ]);
      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        { route: '/properties', budget: 'catalogue', metric: 'js', actualKb: 210, limitKb: 200 },
        {
          route: '/properties/xyz',
          budget: 'detail',
          metric: 'css',
          actualKb: 70,
          limitKb: 60,
        },
      ]);
    });

    it('returns ok with no violations for an empty route list', () => {
      expect(checkBundleBudget([])).toEqual({ ok: true, violations: [] });
    });
  });
});
