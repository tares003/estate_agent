# G11 — Responsive coverage (seven breakpoints)

**Catches:** a changed component / page / visual test that does not assert layout at every canonical breakpoint (`design-requirements.md` §2 / DoD item 4).

**Enforced by:** `packages/config/guards/g11-responsive-coverage.ts` (`checkResponsiveCoverage`, `BREAKPOINTS`), run in CI by `guards/run-all.ts`. It applies to changed test files under `packages/ui/**` or `apps/web/**`, or named `*.visual.*` / `*.a11y.*`.

**Breakpoints (px):** `320 · 640 · 768 · 1024 · 1280 · 1440 · 2560`.

**How it works:** the guard scans a test's source for the breakpoint widths appearing as whole-number tokens (e.g. in `setViewportSize({ width: 768 })`, a `width: 768` literal, or a `[320, 640, …]` array) and fails if any breakpoint is neither asserted nor explicitly opted out.

**Opt-out (used sparingly, recorded in the diff):**

```
// responsive-coverage: opt-out 640 1024 1440 2560
// responsive-coverage: opt-out all
```

**How to satisfy:** assert each of the seven viewports in the component/page test (mirroring `design/canvas/responsive-coverage.json`), mobile-first, with no hover-only interactions.

**Canonical violation → fix:** a test asserting only `320, 768, 1280` (no opt-out) fails with `missing [640, 1024, 1440, 2560]`; asserting all seven — or opting the rest out with the marker — passes.
