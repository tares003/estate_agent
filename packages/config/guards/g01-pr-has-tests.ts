// G1 — PR-has-tests guard.
//
// Per dev-briefs/sprint-01/_tdd-protocol.md, the RED step is committed before
// the GREEN step and an implementation-only diff is rejected in CI. This guard
// classifies the PR's changed paths and fails closed when production code is
// touched with no accompanying test.
//
// Classification (per-path):
//   IMPL — the path contains a /src/, /app/, /pages/, /components/, /routes/
//          or /handlers/ segment.
//   TEST — the path matches *.test.* or *.spec.*, or contains a /__tests__/
//          segment. TEST classification WINS: a file may live under /app/ and
//          still count as a test (e.g. page.test.tsx).
//
// Verdict:
//   - >=1 IMPL and 0 TEST  -> ok:false (implementation without tests).
//   - 0 IMPL               -> ok:true  (test-only / docs-only PRs allowed).
//   - >=1 IMPL and >=1 TEST -> ok:true.

/** Path segments that mark a file as production implementation code. */
const IMPL_SEGMENTS = ['src', 'app', 'pages', 'components', 'routes', 'handlers'];

/** Split a path on either separator into non-empty segments. */
function segmentsOf(path: string): string[] {
  return path.split(/[/\\]/).filter((segment) => segment.length > 0);
}

/** A path is a TEST file if it is a *.test.* / *.spec.* file or sits under __tests__. */
function isTestPath(path: string): boolean {
  const segments = segmentsOf(path);
  const fileName = segments[segments.length - 1] ?? '';
  if (/\.(test|spec)\./.test(fileName)) {
    return true;
  }
  return segments.includes('__tests__');
}

/** A path is IMPL if it contains a known implementation segment (and is not a TEST). */
function isImplPath(path: string): boolean {
  const segments = segmentsOf(path);
  return segments.some((segment) => IMPL_SEGMENTS.includes(segment));
}

/**
 * Decide whether a PR's changed files satisfy the PR-has-tests rule.
 *
 * @param changedFiles - repo-relative paths touched by the PR.
 * @returns ok=false only when at least one IMPL file is present and no TEST
 *          file is present; ok=true otherwise, with a human-readable reason.
 */
export function prHasTests(changedFiles: string[]): { ok: boolean; reason: string } {
  let implCount = 0;
  let testCount = 0;

  for (const path of changedFiles) {
    // TEST classification wins over IMPL when a path could be both.
    if (isTestPath(path)) {
      testCount += 1;
    } else if (isImplPath(path)) {
      implCount += 1;
    }
  }

  if (implCount === 0) {
    return {
      ok: true,
      reason: 'No implementation files touched; test-only or docs-only PRs are allowed.',
    };
  }

  if (testCount === 0) {
    return {
      ok: false,
      reason: `Found ${implCount} implementation file(s) without any accompanying test file (*.test.*, *.spec.*, or under /__tests__/). Commit the RED test before the implementation.`,
    };
  }

  return {
    ok: true,
    reason: `Found ${implCount} implementation file(s) accompanied by ${testCount} test file(s).`,
  };
}
