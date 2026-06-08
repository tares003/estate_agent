#!/usr/bin/env tsx
/**
 * run-all.ts — the live CI runner for the guards that reason about the PR as a
 * whole rather than a single AST node:
 *
 *   G1  PR-has-tests          — implementation diff must ship with a test diff
 *   G2  coverage-threshold    — touched files must meet their scope's coverage
 *   G10 sub-processor-manifest— new external-service deps must be declared
 *   G11 responsive-coverage   — changed visual/component/page tests must assert
 *                               every breakpoint
 *
 * The six AST-level guards (G4, G5, G6, G7, G8, G12) run via ESLint (`pnpm lint`).
 * G3 (bundle budget) and G9 (axe) are runtime/browser gates wired as separate CI
 * jobs once apps/web exists; their evaluation cores are unit-tested under guards/.
 *
 * Each guard's pure logic lives in its own module and is unit-tested with a
 * deliberate-violation fixture (fail-closed) + a clean fixture. This runner just
 * feeds them the real diff / coverage report and aggregates the verdict.
 *
 * Base ref: $GUARDS_BASE_REF, else origin/main, else main. Exits non-zero if any
 * guard fails.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prHasTests } from './g01-pr-has-tests.js';
import { checkCoverage, type TouchedFile } from './g02-coverage-threshold.js';
import { checkSubProcessors } from './g10-sub-processor-manifest.js';
import { checkResponsiveCoverage } from './g11-responsive-coverage.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

/** Run a git command at the repo root, returning trimmed stdout ('' on error). */
function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Resolve a usable base ref for the diff, or null if none verifies. */
function resolveBaseRef(): string | null {
  for (const ref of [process.env.GUARDS_BASE_REF, 'origin/main', 'main']) {
    if (ref && git(['rev-parse', '--verify', '--quiet', ref])) return ref;
  }
  return null;
}

/** All files the PR/branch touches: base diff ∪ working tree ∪ staged ∪ untracked. */
function collectChangedFiles(baseRef: string | null): string[] {
  const files = new Set<string>();
  const ingest = (out: string) => {
    for (const line of out.split(/\r?\n/)) {
      const file = line.trim();
      if (file) files.add(file);
    }
  };
  if (baseRef) ingest(git(['diff', '--name-only', `${baseRef}...HEAD`]));
  ingest(git(['diff', '--name-only', 'HEAD']));
  ingest(git(['diff', '--name-only', '--cached']));
  ingest(git(['ls-files', '--others', '--exclude-standard']));
  return [...files];
}

/** Extract added "key": entries from the diff of every changed package.json. */
function collectAddedDependencies(changed: string[], baseRef: string | null): string[] {
  const names = new Set<string>();
  const keyLine = /^\+\s*"([^"]+)"\s*:/;
  for (const file of changed) {
    if (!file.endsWith('package.json')) continue;
    const diff = baseRef
      ? git(['diff', `${baseRef}...HEAD`, '--', file]) + '\n' + git(['diff', 'HEAD', '--', file])
      : git(['diff', 'HEAD', '--', file]);
    for (const line of diff.split(/\r?\n/)) {
      const match = keyLine.exec(line);
      if (match && match[1]) names.add(match[1]);
    }
  }
  return [...names];
}

/** Service names from the published sub-processor manifest. */
function loadSubProcessorManifest(): string[] {
  const path = resolve(REPO_ROOT, 'docs', 'sub-processors.json');
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { services?: { name: string }[] };
    return (parsed.services ?? []).map((service) => service.name);
  } catch {
    return [];
  }
}

/** A changed test file that exercises a visual surface (so G11 applies). */
function isVisualSurfaceTest(file: string): boolean {
  const path = file.replace(/\\/g, '/');
  const isTest = /\.(test|spec)\.[jt]sx?$/.test(path);
  if (!isTest) return false;
  return (
    path.startsWith('packages/ui/') ||
    path.startsWith('apps/web/') ||
    /\.(visual|a11y)\.[jt]sx?$/.test(path)
  );
}

/** Load Vitest coverage-summary reports (root + per package) into TouchedFile rows. */
function loadCoverage(changed: string[]): TouchedFile[] | null {
  const summaries = [
    resolve(REPO_ROOT, 'coverage', 'coverage-summary.json'),
    ...changed
      .map((f) => f.replace(/\\/g, '/').match(/^(packages\/[^/]+|apps\/[^/]+)\//)?.[1])
      .filter((v): v is string => Boolean(v))
      .map((pkg) => resolve(REPO_ROOT, pkg, 'coverage', 'coverage-summary.json')),
  ].filter((p, i, a) => a.indexOf(p) === i && existsSync(p));

  if (summaries.length === 0) return null;

  const byFile = new Map<string, TouchedFile>();
  for (const summary of summaries) {
    let parsed: Record<string, { lines?: { pct: number }; branches?: { pct: number } }>;
    try {
      parsed = JSON.parse(readFileSync(summary, 'utf8'));
    } catch {
      continue;
    }
    for (const [abs, metrics] of Object.entries(parsed)) {
      if (abs === 'total') continue;
      const rel = resolve(abs)
        .replace(REPO_ROOT + '\\', '')
        .replace(REPO_ROOT + '/', '')
        .replace(/\\/g, '/');
      byFile.set(rel, {
        file: rel,
        lines: metrics.lines?.pct ?? 100,
        branches: metrics.branches?.pct ?? 100,
      });
    }
  }
  const changedSet = new Set(changed.map((f) => f.replace(/\\/g, '/')));
  return [...byFile.values()].filter((row) => changedSet.has(row.file));
}

interface GuardOutcome {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
}

function main(): void {
  const baseRef = resolveBaseRef();
  const changed = collectChangedFiles(baseRef);
  const outcomes: GuardOutcome[] = [];

  // G1 — PR-has-tests.
  const g1 = prHasTests(changed);
  outcomes.push({ id: 'G1', name: 'PR-has-tests', ok: g1.ok, detail: g1.reason });

  // G10 — sub-processor manifest.
  const addedDeps = collectAddedDependencies(changed, baseRef);
  const g10 = checkSubProcessors(addedDeps, loadSubProcessorManifest());
  outcomes.push({
    id: 'G10',
    name: 'sub-processor-manifest',
    ok: g10.ok,
    detail: g10.ok
      ? 'No undeclared external-service dependency added.'
      : g10.violations.map((v) => `${v.dep} -> ${v.service} (undeclared)`).join('; '),
  });

  // G11 — responsive coverage on changed visual/component/page tests.
  const visualTests = changed
    .filter(isVisualSurfaceTest)
    .filter((f) => existsSync(resolve(REPO_ROOT, f)));
  const g11Failures: string[] = [];
  for (const file of visualTests) {
    const result = checkResponsiveCoverage(readFileSync(resolve(REPO_ROOT, file), 'utf8'));
    if (!result.ok) g11Failures.push(`${file} missing [${result.missing.join(', ')}]`);
  }
  outcomes.push({
    id: 'G11',
    name: 'responsive-coverage',
    ok: g11Failures.length === 0,
    detail: g11Failures.length
      ? g11Failures.join('; ')
      : `${visualTests.length} visual test(s) cover every breakpoint.`,
  });

  // G2 — coverage threshold (only when a coverage summary is present).
  const coverage = loadCoverage(changed);
  if (coverage === null) {
    outcomes.push({
      id: 'G2',
      name: 'coverage-threshold',
      ok: true,
      detail: 'No coverage-summary.json found — run with coverage to enforce (skipped).',
    });
  } else {
    const g2 = checkCoverage(coverage);
    outcomes.push({
      id: 'G2',
      name: 'coverage-threshold',
      ok: g2.ok,
      detail: g2.ok
        ? `${coverage.length} touched file(s) meet their scope threshold.`
        : g2.violations
            .map(
              (v) =>
                `${v.file} (${v.scope}) ${v.lines}/${v.branches} < ${v.needLines}/${v.needBranches}`,
            )
            .join('; '),
    });
  }

  const base = baseRef ?? '(no base ref — working tree only)';
  process.stdout.write(`\nCI guards (diff vs ${base}, ${changed.length} changed files)\n`);
  for (const o of outcomes) {
    process.stdout.write(`  ${o.ok ? 'PASS' : 'FAIL'}  ${o.id} ${o.name}: ${o.detail}\n`);
  }

  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length > 0) {
    process.stdout.write(
      `\n${failed.length} guard(s) failed: ${failed.map((o) => o.id).join(', ')}\n`,
    );
    process.exit(1);
  }
  process.stdout.write('\nAll diff-based guards passed.\n');
}

main();
