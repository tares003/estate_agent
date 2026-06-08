# G3 — Performance budget (per-route bundle)

**Catches:** a public route whose gzipped JavaScript or CSS bundle exceeds its budget (`design-requirements.md` §3), or that misses the Core Web Vitals targets.

**Enforced by:** the evaluation core in `packages/config/guards/g03-performance-budget.ts` (`ROUTE_BUDGETS`, `classifyRoute`, `checkBundleBudget`, `CORE_WEB_VITALS`). The full production-build + Lighthouse-CI runtime measurement is a CI job that **activates when `apps/web` ships** (the `runtime-gates` job in `.github/workflows/ci.yml`); the unit-tested core here is what that job feeds.

**Budgets (gzipped):**

| Route              | JS     | CSS   |
| ------------------ | ------ | ----- |
| Public marketing   | 150 KB | 50 KB |
| Property catalogue | 200 KB | 60 KB |
| Property detail    | 220 KB | 60 KB |
| Admin shell        | 350 KB | —     |
| Customer account   | 200 KB | —     |

**Core Web Vitals (p75, mid-range mobile / 4G):** LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1.

**How to satisfy:** keep heavy work in Server Components, code-split client islands, defer/trim third-party dependencies, ship token-driven CSS.

**Canonical violation → fix:** importing a 120 KB charting library into the marketing home client bundle pushes JS to 180 KB (> 150). Move it server-side / lazy-load → back under budget.
