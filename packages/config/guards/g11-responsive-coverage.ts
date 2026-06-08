/**
 * G11 — Responsive-coverage guard (design-requirements.md §3).
 *
 * Every visual-regression / component test must assert layout at each canonical
 * breakpoint — the seven widths the design canvas's `responsive-coverage.json`
 * records. A test that exercises layout but skips a breakpoint silently erodes
 * responsive coverage; this guard fails closed against that.
 *
 * A breakpoint may be deliberately excluded with an inline marker comment so the
 * intent is recorded in the diff rather than hidden:
 *
 *   // responsive-coverage: opt-out 640 1024 1440 2560
 *   // responsive-coverage: opt-out all
 *
 * Any canonical breakpoint number appearing on the SAME line as an `opt-out`
 * marker is treated as opted out (and is not also counted as asserted). The
 * `opt-out all` form opts out every breakpoint regardless of which numbers
 * follow it.
 *
 * The check is a pure function over a test's source text — deterministic, no
 * filesystem, no parsing of the AST. It scans for the canonical breakpoint
 * numbers as whole tokens (so 3201 does not satisfy 320, 25600 does not satisfy
 * 2560). Numbers anywhere in the source count as "asserted" — inside
 * `setViewportSize({ width: 768 })`, a `width: 768` literal, or a `[320, 640]`
 * array literal — which keeps the guard agnostic to test-framework specifics.
 */

/** The seven canonical breakpoint widths, ascending (design-requirements.md §3). */
export const BREAKPOINTS: readonly number[] = [320, 640, 768, 1024, 1280, 1440, 2560];

/** Case-insensitive marker that opts breakpoints out on the line it appears on. */
const OPT_OUT_MARKER = 'responsive-coverage: opt-out';

/**
 * Collect the canonical breakpoint widths that appear as whole-number tokens on
 * a single line of source.
 *
 * A breakpoint matches only when it is not part of a longer run of digits and is
 * not preceded by a decimal point (so 1.320 / 3201 / 25600 do not match). Returns
 * a Set for cheap membership tests.
 */
function breakpointsOnLine(line: string): Set<number> {
  const found = new Set<number>();
  // \d+(?:\.\d+)? matches an integer or decimal; we then keep only the ones whose
  // integer part is exactly a canonical breakpoint and that are not a decimal.
  const numberToken = /(?<![\d.])(\d+)(?:\.\d+)?(?![\d.])/g;
  let match: RegExpExecArray | null;
  while ((match = numberToken.exec(line)) !== null) {
    // A decimal (e.g. 320.5) has a fractional part captured by the surrounding
    // pattern; reject it by checking the full match vs the integer group.
    if (match[0] !== match[1]) continue;
    const value = Number(match[1]);
    if ((BREAKPOINTS as number[]).includes(value)) found.add(value);
  }
  return found;
}

/**
 * Result of a responsive-coverage check.
 * - `ok`     — every breakpoint is asserted or explicitly opted out.
 * - `asserted` — breakpoints found in non-opt-out source, ascending.
 * - `missing`  — breakpoints in neither set, ascending.
 * - `optedOut` — breakpoints excluded via an opt-out marker, ascending.
 */
export interface ResponsiveCoverageResult {
  ok: boolean;
  asserted: number[];
  missing: number[];
  optedOut: number[];
}

/**
 * Check whether a test source asserts (or explicitly opts out of) every canonical
 * breakpoint.
 *
 * @param testSource the full text of a single test file.
 */
export function checkResponsiveCoverage(testSource: string): ResponsiveCoverageResult {
  const asserted = new Set<number>();
  const optedOut = new Set<number>();

  for (const rawLine of testSource.split(/\r?\n/)) {
    const lower = rawLine.toLowerCase();
    const markerIndex = lower.indexOf(OPT_OUT_MARKER);
    if (markerIndex !== -1) {
      const afterMarker = lower.slice(markerIndex + OPT_OUT_MARKER.length);
      // `opt-out all` excludes every breakpoint regardless of trailing numbers.
      if (/\ball\b/.test(afterMarker)) {
        for (const breakpoint of BREAKPOINTS) optedOut.add(breakpoint);
      } else {
        // Any breakpoint number on the marker line is opted out, including any
        // before the marker text — the whole line is a coverage-intent comment.
        for (const breakpoint of breakpointsOnLine(rawLine)) optedOut.add(breakpoint);
      }
      // A marker line never contributes asserted coverage.
      continue;
    }
    for (const breakpoint of breakpointsOnLine(rawLine)) asserted.add(breakpoint);
  }

  // A breakpoint named both as a real assertion and on an opt-out line is treated
  // as opted out (the explicit exclusion wins).
  for (const breakpoint of optedOut) asserted.delete(breakpoint);

  const covered = new Set<number>([...asserted, ...optedOut]);
  const missing = BREAKPOINTS.filter((breakpoint) => !covered.has(breakpoint));

  const ascending = (set: Set<number>): number[] =>
    BREAKPOINTS.filter((breakpoint) => set.has(breakpoint));

  return {
    ok: missing.length === 0,
    asserted: ascending(asserted),
    missing,
    optedOut: ascending(optedOut),
  };
}
