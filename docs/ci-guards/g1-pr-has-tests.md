# G1 — PR-has-tests

**Catches:** an implementation diff that ships with no accompanying test diff — i.e. production code committed without the RED test that should precede it (`_tdd-protocol.md`).

**Enforced by:** `packages/config/guards/g01-pr-has-tests.ts` (`prHasTests`), run in CI by `guards/run-all.ts` against the PR's changed files.

**Classification (per path):**

- **IMPL** — the path contains a `/src/`, `/app/`, `/pages/`, `/components/`, `/routes/` or `/handlers/` segment.
- **TEST** — the filename matches `*.test.*` / `*.spec.*`, or the path contains a `/__tests__/` segment. TEST wins: `page.test.tsx` under `/app/` counts as a test, not impl.

**Verdict:** ≥1 IMPL and 0 TEST → **fail**. 0 IMPL → pass (test-only / docs-only PRs allowed). ≥1 IMPL and ≥1 TEST → pass.

**How to satisfy:** commit the failing RED test in the same PR (and, per the protocol, in an earlier commit) as the implementation. Test-only and docs-only PRs pass freely.

**Canonical violation → fix:** adding `apps/web/app/(public)/properties/page.tsx` with no test fails; add `page.test.tsx` (the RED test) and it passes.
