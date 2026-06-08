import { describe, it, expect } from 'vitest';
import { classifyScope, checkCoverage } from './g02-coverage-threshold.js';

// G2 — Coverage-threshold guard. Computes the per-file line/branch threshold
// from _tdd-protocol.md §5 by classifying each touched file's scope, then
// rejects any touched file whose measured coverage falls below it. Pure
// functions, deterministic inline fixtures only — no I/O, no randomness.
describe('G2 coverage-threshold: classifyScope', () => {
  it('classifies shared packages (NOT packages/ui) as shared', () => {
    expect(classifyScope('packages/validators/src/enquiry.ts')).toBe('shared');
    expect(classifyScope('packages/types/src/property.ts')).toBe('shared');
    expect(classifyScope('packages/tokens/src/index.ts')).toBe('shared');
    expect(classifyScope('packages/auth/src/session.ts')).toBe('shared');
    expect(classifyScope('packages/email/src/send.ts')).toBe('shared');
    expect(classifyScope('packages/storage/src/local.ts')).toBe('shared');
    expect(classifyScope('packages/observability/src/logger.ts')).toBe('shared');
    expect(classifyScope('packages/entitlement/src/index.ts')).toBe('shared');
    expect(classifyScope('packages/config/guards/g02-coverage-threshold.ts')).toBe('shared');
    expect(classifyScope('packages/utils/src/format.ts')).toBe('shared');
  });

  it('classifies packages/ui as ui (not shared)', () => {
    expect(classifyScope('packages/ui/src/Button.tsx')).toBe('ui');
  });

  it('classifies apps/web/app/** as page', () => {
    expect(classifyScope('apps/web/app/properties/page.tsx')).toBe('page');
  });

  it('classifies route handlers, /handlers/ and /api/ paths as handler', () => {
    expect(classifyScope('apps/web/app/api/enquiries/route.ts')).toBe('handler');
    expect(classifyScope('apps/web/server/handlers/create-enquiry.ts')).toBe('handler');
    expect(classifyScope('packages/auth/src/api/session.ts')).toBe('handler');
  });

  it('classifies apps/workers/** as worker', () => {
    expect(classifyScope('apps/workers/src/email-sender.ts')).toBe('worker');
  });

  it('classifies repositories/services (default) as domain', () => {
    expect(classifyScope('apps/web/server/repositories/property-repository.ts')).toBe('domain');
    expect(classifyScope('apps/web/server/services/viewing-service.ts')).toBe('domain');
  });

  it('classifies auto-generated paths as excluded', () => {
    expect(classifyScope('packages/db/generated/client.ts')).toBe('excluded');
    expect(classifyScope('packages/db/node_modules/.prisma/client/index.js')).toBe('excluded');
    expect(classifyScope('apps/web/.next/server/app/page.js')).toBe('excluded');
    expect(classifyScope('packages/types/src/property.d.ts')).toBe('excluded');
  });
});

describe('G2 coverage-threshold: checkCoverage', () => {
  // VIOLATION case — fail-closed proof. A shared package needs 100/100; 92%
  // branch coverage on a validator must be rejected.
  it('rejects a shared-package file below the 100/100 threshold', () => {
    const result = checkCoverage([
      { file: 'packages/validators/src/enquiry.ts', lines: 100, branches: 92 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      {
        file: 'packages/validators/src/enquiry.ts',
        scope: 'shared',
        lines: 100,
        branches: 92,
        needLines: 100,
        needBranches: 100,
      },
    ]);
  });

  // CLEAN case — a shared file that meets 100/100 passes.
  it('passes a shared-package file that meets the 100/100 threshold', () => {
    const result = checkCoverage([
      { file: 'packages/validators/src/enquiry.ts', lines: 100, branches: 100 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('passes a ui file that meets the 90/80 threshold', () => {
    const result = checkCoverage([{ file: 'packages/ui/src/Button.tsx', lines: 95, branches: 85 }]);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('skips auto-generated (excluded) files and never marks them a violation', () => {
    const result = checkCoverage([
      { file: 'packages/db/generated/client.ts', lines: 10, branches: 0 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('flags a file when EITHER lines OR branches falls below the threshold', () => {
    // ui needs 90/80: lines below, branches fine.
    const linesShort = checkCoverage([
      { file: 'packages/ui/src/Button.tsx', lines: 85, branches: 90 },
    ]);
    expect(linesShort.ok).toBe(false);
    expect(linesShort.violations[0]?.scope).toBe('ui');

    // page needs 80/70: lines fine, branches below.
    const branchesShort = checkCoverage([
      { file: 'apps/web/app/properties/page.tsx', lines: 85, branches: 65 },
    ]);
    expect(branchesShort.ok).toBe(false);
    expect(branchesShort.violations[0]?.scope).toBe('page');
  });

  it('reports only the violating files in a mixed batch', () => {
    const result = checkCoverage([
      { file: 'packages/validators/src/enquiry.ts', lines: 100, branches: 100 }, // clean shared
      { file: 'packages/ui/src/Button.tsx', lines: 70, branches: 60 }, // violating ui
      { file: 'packages/db/generated/client.ts', lines: 0, branches: 0 }, // excluded
      { file: 'apps/workers/src/email-sender.ts', lines: 95, branches: 85 }, // clean worker
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.file)).toEqual(['packages/ui/src/Button.tsx']);
  });

  it('returns ok with no violations for an empty touched list', () => {
    const result = checkCoverage([]);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('normalises Windows-style backslash paths before classifying', () => {
    const result = checkCoverage([
      { file: 'packages\\validators\\src\\enquiry.ts', lines: 100, branches: 90 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.scope).toBe('shared');
  });
});
