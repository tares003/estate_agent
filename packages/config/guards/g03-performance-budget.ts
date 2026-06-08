/**
 * G3 — Performance-budget guard (budget-evaluation core).
 *
 * This module is the deterministic, unit-testable HEART of the performance
 * gate: it owns the per-route bundle-budget table and Core Web Vitals
 * thresholds from design-requirements.md §3, classifies a route path into its
 * budget bucket, and evaluates a set of measured bundle sizes against the
 * matching budgets.
 *
 * It intentionally does NOT measure anything itself. The numbers it consumes
 * (gzipped JS / CSS per route, and later the field LCP/INP/CLS) come from a
 * production build + Lighthouse CI run, which is wired as a separate CI job
 * (Lighthouse CI per route per CLAUDE.md §9 / design-requirements.md §3). That
 * CI job collects the measurements and feeds them to `checkBundleBudget`; the
 * job fails when `ok` is false. Keeping the evaluation logic pure here means it
 * can be exhaustively unit-tested without a browser, a build, or a network.
 *
 * Budgets are gzipped kilobytes, per route. `admin` and `customer` have no CSS
 * budget in §3 (the admin shell is a one-time load, code-split per section
 * thereafter), so CSS is simply not measured for those buckets.
 */

/** A bundle budget for a route bucket. `css` is omitted where §3 sets none. */
export interface BundleBudget {
  /** Maximum gzipped JavaScript, in KB. */
  readonly js: number;
  /** Maximum gzipped CSS, in KB. Absent buckets have no CSS budget. */
  readonly css?: number;
}

/**
 * Per-route-bucket bundle budgets (gzipped KB), verbatim from
 * design-requirements.md §3 "Bundle budgets (per route, gzipped)".
 */
export const ROUTE_BUDGETS = {
  /** Public marketing routes: JS ≤ 150 KB, CSS ≤ 50 KB. */
  marketing: { js: 150, css: 50 },
  /** Property catalogue: JS ≤ 200 KB, CSS ≤ 60 KB. */
  catalogue: { js: 200, css: 60 },
  /** Property detail: JS ≤ 220 KB, CSS ≤ 60 KB. */
  detail: { js: 220, css: 60 },
  /** Admin shell: JS ≤ 350 KB (no CSS budget — code-split per section). */
  admin: { js: 350 },
  /** Customer account: JS ≤ 200 KB (no CSS budget). */
  customer: { js: 200 },
} as const satisfies Record<string, BundleBudget>;

/**
 * Core Web Vitals field thresholds (75th percentile) from
 * design-requirements.md §3. Exported for the Lighthouse CI job to assert
 * against collected field metrics; not used by `checkBundleBudget`.
 */
export const CORE_WEB_VITALS = {
  /** Largest Contentful Paint ≤ 2.5 s @ p75. */
  lcpSeconds: 2.5,
  /** Interaction to Next Paint ≤ 200 ms @ p75. */
  inpMs: 200,
  /** Cumulative Layout Shift ≤ 0.1 @ p75. */
  cls: 0.1,
} as const;

/** The set of route-budget bucket keys. */
export type RouteBudgetKey = keyof typeof ROUTE_BUDGETS;

/**
 * Normalise a path: strip the query/hash and any trailing slash (except root).
 */
function normalise(path: string): string {
  const noQuery = path.split(/[?#]/, 1)[0] ?? path;
  if (noQuery.length > 1 && noQuery.endsWith('/')) {
    return noQuery.slice(0, -1);
  }
  return noQuery;
}

/**
 * Classify a route path into its performance-budget bucket.
 *
 * - `/admin` and anything beneath it -> `admin`.
 * - `/account` and anything beneath it -> `customer`.
 * - `/properties` (the catalogue index) -> `catalogue`.
 * - `/properties/<id>` (a single property detail page) -> `detail`.
 * - everything else (home, about, contact, …) -> `marketing`.
 */
export function classifyRoute(path: string): RouteBudgetKey {
  const p = normalise(path);

  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/account' || p.startsWith('/account/')) return 'customer';

  if (p === '/properties') return 'catalogue';
  if (p.startsWith('/properties/')) {
    // /properties/<id> is a detail page; the bare /properties index is the
    // catalogue (handled above).
    return 'detail';
  }

  return 'marketing';
}

/** A measured route's gzipped bundle sizes (the input to the budget check). */
export interface RouteBundleMeasurement {
  /** The route path as deployed (e.g. '/', '/properties', '/properties/42'). */
  readonly route: string;
  /** Measured gzipped JavaScript, in KB. */
  readonly jsKb: number;
  /** Measured gzipped CSS, in KB. Absent when not measured / no CSS budget. */
  readonly cssKb?: number;
}

/** A single budget breach. */
export interface BudgetViolation {
  /** The route that breached. */
  readonly route: string;
  /** The budget bucket the route was classified into. */
  readonly budget: RouteBudgetKey;
  /** Which metric breached. */
  readonly metric: 'js' | 'css';
  /** The measured value, in KB. */
  readonly actualKb: number;
  /** The budget limit it exceeded, in KB. */
  readonly limitKb: number;
}

/** The outcome of evaluating a set of route measurements. */
export interface BudgetResult {
  /** True when no measured route breached its budget. */
  readonly ok: boolean;
  /** Every breach found, in route-then-metric (JS before CSS) order. */
  readonly violations: BudgetViolation[];
}

/**
 * Evaluate measured bundle sizes against the §3 budgets.
 *
 * Each route is classified, then its JS (and CSS, where the bucket has a CSS
 * budget) is compared to the limit. A value AT the limit is within budget; only
 * strictly-greater values breach. CSS is skipped for buckets with no CSS budget
 * (admin, customer) and for measurements with no `cssKb`.
 */
export function checkBundleBudget(routes: RouteBundleMeasurement[]): BudgetResult {
  const violations: BudgetViolation[] = [];

  for (const { route, jsKb, cssKb } of routes) {
    const budget = classifyRoute(route);
    const limits = ROUTE_BUDGETS[budget];

    if (jsKb > limits.js) {
      violations.push({ route, budget, metric: 'js', actualKb: jsKb, limitKb: limits.js });
    }

    const cssLimit = (limits as BundleBudget).css;
    if (cssLimit !== undefined && cssKb !== undefined && cssKb > cssLimit) {
      violations.push({ route, budget, metric: 'css', actualKb: cssKb, limitKb: cssLimit });
    }
  }

  return { ok: violations.length === 0, violations };
}
