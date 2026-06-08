import { describe, it, expect } from 'vitest';
import { prHasTests } from './g01-pr-has-tests.js';

// G1 — PR-has-tests guard. Per _tdd-protocol.md, an implementation-only diff
// must be rejected: any PR that touches IMPL code without a matching TEST file
// fails closed. Test-only and docs-only PRs are allowed (they cannot regress
// untested production code).
describe('G1 PR-has-tests', () => {
  it('rejects an implementation-only PR (the deliberate violation, fail-closed proof)', () => {
    const result = prHasTests(['apps/web/app/(public)/properties/page.tsx']);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/without/i);
  });

  it('passes when an impl file is accompanied by its test', () => {
    const result = prHasTests([
      'apps/web/app/(public)/properties/page.tsx',
      'apps/web/app/(public)/properties/page.test.tsx',
    ]);
    expect(result.ok).toBe(true);
  });

  it('passes a test-only PR (TEST classification wins even under /app/)', () => {
    const result = prHasTests(['apps/web/app/(public)/properties/page.test.tsx']);
    expect(result.ok).toBe(true);
  });

  it('passes a docs-only PR (no impl files at all)', () => {
    const result = prHasTests(['README.md', 'docs/x.md']);
    expect(result.ok).toBe(true);
  });

  it('treats *.spec.* and /__tests__/ as TEST', () => {
    expect(
      prHasTests(['packages/validators/src/enquiry.ts', 'packages/validators/src/enquiry.spec.ts'])
        .ok,
    ).toBe(true);
    expect(
      prHasTests(['apps/web/components/EnquiryForm.tsx', 'apps/web/__tests__/EnquiryForm.tsx']).ok,
    ).toBe(true);
  });

  it('classifies IMPL via /src/, /components/, /routes/, /handlers/, /pages/ segments', () => {
    expect(prHasTests(['packages/db/src/client.ts']).ok).toBe(false);
    expect(prHasTests(['apps/web/components/PropertyCard.tsx']).ok).toBe(false);
    expect(prHasTests(['services/api/routes/properties.ts']).ok).toBe(false);
    expect(prHasTests(['apps/web/handlers/signed-url.ts']).ok).toBe(false);
    expect(prHasTests(['apps/web/pages/legacy.tsx']).ok).toBe(false);
  });

  it('allows an empty changeset (nothing to gate)', () => {
    expect(prHasTests([]).ok).toBe(true);
  });
});
