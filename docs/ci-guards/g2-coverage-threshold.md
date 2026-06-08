# G2 — Coverage threshold on touched files

**Catches:** a file touched by the PR whose line/branch coverage is below the threshold for its scope (`_tdd-protocol.md` §5).

**Enforced by:** `packages/config/guards/g02-coverage-threshold.ts` (`classifyScope`, `checkCoverage`), run in CI by `guards/run-all.ts` (which reads the Vitest `coverage-summary.json` and maps each touched file to its scope).

**Thresholds (line / branch):**

| Scope    | Paths                                         | Line | Branch |
| -------- | --------------------------------------------- | ---- | ------ |
| shared   | `packages/*` except `packages/ui`             | 100  | 100    |
| ui       | `packages/ui/**`                              | 90   | 80     |
| page     | `apps/web/app/**`                             | 80   | 70     |
| handler  | `**/route.ts`, `/handlers/`, `/api/`          | 90   | 80     |
| worker   | `apps/workers/**`                             | 90   | 80     |
| domain   | everything else (repositories/services)       | 90   | 80     |
| excluded | `/generated/`, `.prisma`, `/.next/`, `*.d.ts` | —    | —      |

**How to satisfy:** add tests until each touched file meets its scope threshold. Shared packages (validators, types, tokens, helpers) require **100/100** — cover every branch, including the negative/validation paths.

**Canonical violation → fix:** `packages/validators/src/enquiry.ts` at 100% line / 92% branch fails (shared needs 100/100 — an untested negative-validation branch). Add the missing branch test → passes.
