import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';

// CI-workflow contract — the Testcontainers integration suites MUST run in CI,
// fail-closed (audit: ci-never-runs-integration-suites).
//
// The real-engine integration suites (packages/db real-postgres +
// auth-tenant-scope, apps/web properties radius search) are the ONLY
// verification that the RLS tenant-isolation policies, the 0006 composite
// tenant FKs and the assembled PostGIS radius SQL actually work on a real
// PostgreSQL engine. Both vitest unit configs exclude `*.integration.test.ts`,
// so unless a dedicated CI job invokes the `test:integration` scripts these
// suites never execute anywhere. And because each suite is
// `describe.skipIf(!DOCKER)`, a CI runner with a broken/missing Docker daemon
// would GREEN-SKIP them silently — a migration regression that breaks RLS
// would pass CI.
//
// This suite pins both halves of the contract:
//   1. `.github/workflows/ci.yml` has an `integration` job that installs with a
//      frozen lockfile, generates the Prisma client, and runs BOTH
//      `test:integration` scripts on ubuntu-latest with DOCKER_REQUIRED=1.
//   2. Every `*.integration.test.ts` file honours DOCKER_REQUIRED: when it is
//      set and Docker is unreachable, the suite throws (hard failure) instead
//      of skipping.

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

const ciYml = readFileSync(resolve(REPO_ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

/**
 * Extract one job's block from the workflow source. Job names are the only
 * keys indented exactly two spaces after the `jobs:` map begins; the block
 * runs until the next two-space key (the next job) or EOF.
 */
function jobBlock(name: string): string {
  const jobsStart = ciYml.indexOf('\njobs:');
  if (jobsStart === -1) return '';
  const jobs = ciYml.slice(jobsStart);
  const keys = [...jobs.matchAll(/^ {2}([\w-]+):[^\n]*$/gm)];
  const at = keys.findIndex((match) => match[1] === name);
  const start = keys[at]?.index;
  if (at === -1 || start === undefined) return '';
  const end = keys[at + 1]?.index ?? jobs.length;
  return jobs.slice(start, end);
}

describe('CI workflow — Testcontainers integration job (ci.yml)', () => {
  const integration = jobBlock('integration');

  it('defines an `integration` job', () => {
    expect(integration).not.toBe('');
  });

  it('runs on ubuntu-latest (Docker available for Testcontainers) and is not disabled', () => {
    expect(integration).toContain('runs-on: ubuntu-latest');
    // The runtime-gates job is parked behind `if: ${{ false }}`; the
    // integration job must never be.
    expect(integration).not.toContain('if: ${{ false }}');
  });

  it('installs with a frozen lockfile and generates the Prisma client first', () => {
    expect(integration).toContain('pnpm install --frozen-lockfile');
    expect(integration).toContain('pnpm --filter @estate/db run db:generate');
  });

  it('runs the @estate/db integration suite (RLS, composite tenant FKs, PostGIS)', () => {
    expect(integration).toMatch(/pnpm --filter @estate\/db (?:run )?test:integration/);
  });

  it('runs the @estate/web integration suite (radius-search SQL on real PostGIS)', () => {
    expect(integration).toMatch(/pnpm --filter @estate\/web (?:run )?test:integration/);
  });

  it('sets DOCKER_REQUIRED=1 so a missing Docker daemon FAILS the job, never green-skips', () => {
    expect(integration).toMatch(/DOCKER_REQUIRED:\s*'1'/);
  });
});

describe('integration suites — fail-closed Docker gate', () => {
  const files = fg
    .sync(['apps/**/*.integration.test.ts', 'packages/**/*.integration.test.ts'], {
      cwd: REPO_ROOT,
      ignore: ['**/node_modules/**'],
      absolute: true,
    })
    .sort();

  it('finds the Testcontainers integration suites', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('every integration suite throws (not skips) when DOCKER_REQUIRED=1 and Docker is unreachable', () => {
    const missingGate = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return !(source.includes('DOCKER_REQUIRED') && source.includes('throw new Error'));
    });
    expect(missingGate).toEqual([]);
  });
});
