/**
 * G9 — Accessibility-smoke guard (CLAUDE.md §2 "Performance / accessibility
 * budgets are enforced in CI"; tooling: `@axe-core/playwright`).
 *
 * This file is the *unit-testable evaluation core* of the accessibility gate:
 * a pure function that decides pass/fail from an axe-core result object. It has
 * no runtime dependency on Playwright, axe, the DOM, the network or the
 * filesystem, so it is fast and deterministic to test in Vitest.
 *
 * The full runtime scan — `@axe-core/playwright`'s `AxeBuilder` driving a real
 * page through axe-core configured for WCAG 2.2 AA, run at each of the 7
 * responsive breakpoints in the canvas's `responsive-coverage.json` — is wired
 * as a separate Playwright CI job later. That job feeds each page's axe
 * `results` object into `evaluateAxe` and fails the build on the first
 * non-empty `violationIds`.
 *
 * Rule: fail on ANY violation. Because the axe run is configured for WCAG 2.2
 * AA, every entry axe returns in `violations` is, by definition, an AA failure
 * — there is no "advisory" bucket to tolerate. So the gate is strict equality
 * with zero: `ok` iff there are no violations.
 */

/** A single axe-core violation (the subset this evaluator inspects). */
export interface AxeViolation {
  /** axe rule id, e.g. 'color-contrast', 'label', 'aria-required-attr'. */
  id: string;
  /** axe impact bucket — informational only; presence alone is the failure. */
  impact?: string;
}

/** The shape of the axe-core results object consumed by the gate. */
export interface AxeResult {
  violations: AxeViolation[];
}

/** The verdict the CI job acts on. */
export interface AxeVerdict {
  /** True iff the page produced zero WCAG 2.2 AA violations. */
  ok: boolean;
  /** The ids of every violation, in axe's returned order (for the report). */
  violationIds: string[];
}

/**
 * Evaluate an axe-core result against the WCAG 2.2 AA gate.
 *
 * Fail-closed: any violation at all makes `ok` false. The `impact` field is
 * carried by axe but not weighed here — an AA-configured run returns only AA
 * failures, so a "minor"/"serious"/"critical" distinction does not change the
 * verdict; it only informs the human-readable report downstream.
 *
 * @param result the axe-core results object (only `violations` is read).
 * @returns the verdict: `ok` plus the list of violation ids.
 */
export function evaluateAxe(result: AxeResult): AxeVerdict {
  const violationIds = result.violations.map((violation) => violation.id);
  return {
    ok: violationIds.length === 0,
    violationIds,
  };
}
