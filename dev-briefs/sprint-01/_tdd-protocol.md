# Sprint 01 — TDD protocol

This document is the **discipline** for writing code on this project. It is stack-neutral: the rules apply regardless of which test runners, mocking libraries or coverage tools the chosen stack uses. Stack-specific specifics are recorded in per-app `CLAUDE.md` files when the stack is committed.

## 1. RED — GREEN — REFACTOR

Every piece of work follows this loop:

1. **RED.** Write the tests for the next small slice of behaviour. Commit them in a separate commit (`test(<scope>): failing tests for <story>`). The tests should fail because the behaviour does not yet exist. Do not write production code in this commit.
2. **GREEN.** Implement the smallest change that makes every red test pass. Commit (`feat(<scope>): <story> per brief`). Do not over-implement; do not add behaviour not driven by a failing test.
3. **REFACTOR.** While the tests stay green, restructure for clarity. Extract shared helpers if reuse has emerged. Commit (`refactor(<scope>): <reason>`). Skip this commit if no refactor was needed.

The PR-has-tests CI guard rejects any PR whose diff includes production code without a corresponding test diff in an earlier commit.

## 2. Test layers (stack-neutral)

| Layer | Purpose | Required for | Coverage gate |
|---|---|---|---|
| **Unit** | A single function, class or pure helper, in isolation, no I/O. | Every shared helper, validator, type guard, formatter. | 100% |
| **Component** | A single UI component, with its props, states and accessibility behaviour. | Every component in the shared UI primitives package and every page-level organism. | 90% line, 80% branch |
| **Integration** | Two or more units working together through their real interfaces (handler + validator, handler + DB, repository + DB). | Every API capability defined in master spec Section K; every state transition defined in Section G (repairs) and Section I (CRM). | 85% |
| **Contract** | The interface contract between the front-end and the back-end. The contract is the source of truth; the test fails if either side drifts. | Every API capability. | All capabilities covered. |
| **End-to-end** | A complete user journey through the live UI against a running back-end. | Every user journey listed in master spec Section R.4. | All journeys covered. |
| **Visual regression** | A pixel comparison of a rendered component or page against an approved baseline. | Every component in the UI primitives package and every page-level surface. | All baselines green. |
| **Accessibility** | Automated WCAG check of a rendered surface. | Every public route and every admin route. | Zero AA violations. |
| **Property-based** | Generative tests that explore a large input space. | Validators, formatters, sorter / filter pure functions. | At least one property test per such helper. |
| **Performance** | Bundle-size and runtime-performance assertions. | Every public route's bundle (gzipped JS + CSS), LCP under target, INP under target. | Per `design-requirements.md` section 3. |

A piece of work may not require every layer. The brief states which layers apply.

## 3. Per-ticket test mapping pattern

Every dev brief includes a "Test mapping" section structured as:

```
Test mapping
============
FR-1 → tests/unit/<file>.test.* (asserts: <list>)
FR-2 → tests/component/<file>.test.* (asserts: <list>)
FR-3 → tests/integration/<file>.test.* (asserts: <list>)
FR-4 → tests/e2e/<journey>.spec.* (asserts: <list>)
Visual → tests/visual/<surface>.spec.*
Accessibility → tests/a11y/<surface>.spec.*
```

The autonomous agent is required to honour this mapping. Test file locations and naming follow the chosen stack's convention but the assertions named in the brief must appear verbatim.

## 4. Naming conventions for tests

- Test files: `<unit-under-test>.test.*` or `<unit-under-test>.spec.*` — the chosen stack dictates the precise extension.
- Test cases: written as full sentences in present tense, no "should" prefix. Example: `"rejects a viewing request whose preferred date is in the past"`.
- Test fixtures: `<entity>.fixture.*` and exported as named values like `validPropertyFixture` and `expiredViewingFixture`.

## 5. Coverage gates

| Scope | Line coverage | Branch coverage |
|---|---|---|
| Shared package (validators, types, tokens, helpers) | 100% | 100% |
| API handlers | 90% | 80% |
| Domain logic (repositories, services) | 90% | 80% |
| UI primitives | 90% | 80% |
| Page-level surfaces | 80% | 70% |
| CRON / background workers | 90% | 80% |
| Auto-generated code (e.g. ORM bindings) | excluded |

The coverage CI gate (G2 in `_cross-cutting.md`) computes the threshold per the table above and rejects any PR that drops coverage on a touched file below it.

## 6. Regression harness

A growing **regression suite** accumulates one assertion per shipped ticket. At the end of every sprint, the regression suite is the highest-confidence guarantee that previously shipped behaviour is intact.

Format:

```
tests/regression/
  EPIC-A/
    <ticket-id>.regression.test.*
  EPIC-B/
    ...
```

Each regression file contains one or more assertions that are derived from the brief's acceptance criteria. They are intentionally redundant with the per-ticket test suite — the regression suite is the long-tail safety net.

When a regression test catches a fix, the corresponding per-ticket test is reviewed and updated.

## 7. Fixtures and seed data

- Deterministic fixtures only. Random values in tests are forbidden; if a generative case is needed, use property-based testing with a fixed seed.
- Fixtures live under `tests/fixtures/<entity>.fixture.*`.
- Shared seed for end-to-end tests lives under `tests/seed/<scenario>.seed.*`. Each scenario is named for the journey it supports (`seed/buyer-journey.seed.ts`, `seed/repair-emergency.seed.ts`).
- Fixtures use the canonical naming from `PRODUCT.md` and the type definitions from the shared `types` package.

## 8. Mocking policy

- The default is to not mock. Tests prefer the real subject under test.
- External services (email provider, SMS provider, anti-spam service) are mocked at the integration boundary so the test does not depend on the live service.
- Database is mocked only at the unit-test layer. Integration tests use a real database (a test instance per CI run).
- Time and randomness are always controlled in tests — the system clock is injected; random sources use a seeded generator.

## 9. When TDD slows you down — the spike escape hatch

If the shape of an external API, an external library or an unknown third-party integration is genuinely unknown and writing a meaningful failing test first is impossible:

1. Open a spike branch named `spike/<EPIC-ID>-<topic>`.
2. Write throwaway exploratory code on that branch. Do not write tests.
3. Once the shape is understood, **delete the spike entirely**.
4. Restart on a fresh feature branch with TDD discipline.

Spike code is never merged. If a spike's findings are valuable, document them in `docs/spikes/<topic>.md` as plain prose — the implementation is rewritten under TDD.

## 10. RED enforcement

The PR-has-tests CI guard (G1) verifies that production code does not appear before test code in the commit history of a PR. Specifically:

- The first commit on a feature branch that touches production code must be preceded by a test commit whose tests cover that code.
- Squashing or rebasing is permitted but the linear history of the PR (as viewed by the CI workflow) must show the RED commit before the GREEN commit.

If the guard is bypassed via emergency override (a rare last-resort), the override is logged and a follow-up ticket is opened to retroactively add the missing tests.

## 11. Failure investigation

When a test fails in CI:

1. Reproduce locally with the same seed and the same data fixture.
2. Identify whether the failure indicates a real regression, a flaky test, or a fixture drift.
3. Real regressions get a fix commit (`fix(<scope>): <regression>`) with a new test that would have caught the regression earlier added in a preceding commit.
4. Flaky tests are quarantined (skipped with a comment linking to a tracking ticket) and triaged within one sprint. A flaky test that has not been triaged within one sprint is deleted; flaky tests left in the suite erode trust.

## 12. Coverage of non-functional requirements

Some requirements in this project are non-functional and need specific test layers:

- **Performance:** assertions live in `tests/performance/` and use a synthetic LCP / INP / CLS measurement.
- **Security:** authorisation tests assert that the cross-tenant isolation rules in `PRODUCT.md` and master spec Section S hold. Every capability has at least one negative authorisation test.
- **Accessibility:** every component test asserts at least one accessibility property (focus management, label association, keyboard reach).
- **Compliance:** GDPR-consent capture, audit-log emission and sub-processor adherence are asserted in integration tests.

## 13. Test data privacy

Tests never use real personal data. Fixtures use synthetic names, emails and addresses sourced from a controlled list (e.g. `Albert Aardvark, aardvark@example.invalid`). Production data must not be loaded into the test environment.

## 14. Test naming for the regression suite

Each regression test names the ticket it pinned and the assertion in one line, so a future agent searching for "EPIC-G repair emergency" finds the canonical assertion immediately.

```
tests/regression/EPIC-G/EPIC-G-repair-emergency.regression.test.*
  it("emergency-urgency repair ticket triggers SMS, in-app and team-messaging channels simultaneously")
```

## 15. Authority

This document is part of the foundation set. Amendments require review. If a per-app `CLAUDE.md` contradicts this protocol, this protocol wins until the contradiction is documented and resolved at the sprint level.
