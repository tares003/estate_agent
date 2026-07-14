// @vitest-environment node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// EPIC-O guardrail. The `robots.ts` and `sitemap.ts` unit tests import the route
// functions directly, so they pass WHEREVER the files live — they do NOT prove the
// routes are actually served. This test pins the one thing that decides whether they
// are: their location on disk.
//
// Next.js only registers a metadata-convention route file (`robots.ts` → `/robots.txt`,
// `sitemap.ts` → `/sitemap.xml`) when it sits at the TRUE app root. A copy nested inside
// a route group (`app/(app)/robots.ts`) is silently NOT registered: the request falls
// through to the catch-all (`app/(app)/[...slug]/page.tsx`), which needs Payload + a
// resolved tenant and returns 500. Moving these files back into `(app)/` reintroduces
// that 500 with green unit tests — exactly the failure this guardrail exists to catch.

const APP_ROOT = dirname(fileURLToPath(import.meta.url));

describe('metadata routes are served (EPIC-O)', () => {
  it('serves robots.txt: robots.ts lives at the true app root, not in a route group', () => {
    expect(existsSync(join(APP_ROOT, 'robots.ts'))).toBe(true);
    expect(existsSync(join(APP_ROOT, '(app)', 'robots.ts'))).toBe(false);
  });

  it('serves sitemap.xml: sitemap.ts lives at the true app root, not in a route group', () => {
    expect(existsSync(join(APP_ROOT, 'sitemap.ts'))).toBe(true);
    expect(existsSync(join(APP_ROOT, '(app)', 'sitemap.ts'))).toBe(false);
  });
});
