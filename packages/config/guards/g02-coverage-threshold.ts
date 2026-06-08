/**
 * G2 — Coverage-threshold guard (per `_tdd-protocol.md` §5).
 *
 * The CI coverage gate must reject any PR that drops a touched file's coverage
 * below the threshold for that file's scope. The threshold depends on what the
 * file IS — a shared package helper, a UI primitive, a page surface, a route
 * handler, a worker, domain logic, or auto-generated code that is excluded.
 *
 * This module is pure: `classifyScope` maps a repo-relative path to its scope,
 * and `checkCoverage` applies the per-scope threshold to a list of touched
 * files (the line/branch numbers come from the coverage reporter in CI). No
 * I/O, no globbing, no clock, no randomness — deterministic and unit-testable.
 *
 * Thresholds (_tdd-protocol.md §5):
 *   shared (packages/* except packages/ui) ... 100 line / 100 branch
 *   ui     (packages/ui) ....................... 90 / 80
 *   page   (apps/web/app/**) .................... 80 / 70
 *   handler (/route.ts, /handlers/, /api/) ..... 90 / 80
 *   worker (apps/workers/**) ................... 90 / 80
 *   domain (default: repositories/services) ... 90 / 80
 *   excluded (generated/.prisma/.next/.d.ts) .. skipped (never a violation)
 */

export type Scope = 'shared' | 'ui' | 'page' | 'handler' | 'worker' | 'domain' | 'excluded';

/** A single touched file with its measured coverage percentages (0–100). */
export interface TouchedFile {
  file: string;
  lines: number;
  branches: number;
}

/** One file that failed its scope's threshold, with the requirement attached. */
export interface CoverageViolation {
  file: string;
  scope: string;
  lines: number;
  branches: number;
  needLines: number;
  needBranches: number;
}

/** The outcome of checking a batch of touched files. */
export interface CoverageResult {
  ok: boolean;
  violations: CoverageViolation[];
}

/** Per-scope line/branch requirement. `excluded` carries no requirement. */
const THRESHOLDS: Record<Exclude<Scope, 'excluded'>, { lines: number; branches: number }> = {
  shared: { lines: 100, branches: 100 },
  ui: { lines: 90, branches: 80 },
  page: { lines: 80, branches: 70 },
  handler: { lines: 90, branches: 80 },
  worker: { lines: 90, branches: 80 },
  domain: { lines: 90, branches: 80 },
};

/** Normalise to forward-slash so Windows-style paths classify identically. */
function normalise(file: string): string {
  return file.replace(/\\/g, '/');
}

/**
 * Classify a repo-relative file path into its coverage scope.
 *
 * Order matters: auto-generated paths are excluded first (they may live under
 * any package); handlers are detected before the page / shared bucket so an
 * API route under `apps/web/app` is treated as a handler, not a page.
 *
 * @param file repo-relative path (POSIX or Windows separators accepted)
 */
export function classifyScope(file: string): Scope {
  const path = normalise(file);

  // Auto-generated code is excluded regardless of where it sits.
  if (
    path.includes('/generated/') ||
    path.includes('.prisma') ||
    path.includes('/.next/') ||
    path.endsWith('.d.ts')
  ) {
    return 'excluded';
  }

  // Route handlers / API surface — checked before page + shared so an
  // `app/api/.../route.ts` is a handler, not a page.
  if (path.includes('/route.ts') || path.includes('/handlers/') || path.includes('/api/')) {
    return 'handler';
  }

  // Background workers.
  if (path.startsWith('apps/workers/')) {
    return 'worker';
  }

  // Page-level surfaces.
  if (path.startsWith('apps/web/app/')) {
    return 'page';
  }

  // Shared packages: everything under packages/* EXCEPT packages/ui.
  if (path.startsWith('packages/ui/')) {
    return 'ui';
  }
  if (path.startsWith('packages/')) {
    return 'shared';
  }

  // Anything else (repositories, services, server code) is domain logic.
  return 'domain';
}

/**
 * Check a batch of touched files against their per-scope coverage thresholds.
 * A file is a violation when its line coverage OR its branch coverage is below
 * the requirement for its scope. Excluded (auto-generated) files are skipped.
 *
 * @param touched touched files with measured line/branch coverage percentages
 * @returns ok=false plus the list of violating files when any file falls short
 */
export function checkCoverage(touched: TouchedFile[]): CoverageResult {
  const violations: CoverageViolation[] = [];

  for (const entry of touched) {
    const scope = classifyScope(entry.file);
    if (scope === 'excluded') continue;

    const need = THRESHOLDS[scope];
    if (entry.lines < need.lines || entry.branches < need.branches) {
      violations.push({
        file: entry.file,
        scope,
        lines: entry.lines,
        branches: entry.branches,
        needLines: need.lines,
        needBranches: need.branches,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
