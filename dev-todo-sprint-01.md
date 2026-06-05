# Dev todo — Sprint 01

Sprint 01 lays the **foundation**. No user-facing feature ships in this sprint. The deliverables are: the shared packages, the database migration set, the CI guards, and the discipline that every subsequent sprint will lean on.

| Order | Epic / ticket | Brief | Phase (per `_cross-cutting.md`) | Status |
|---|---|---|---|---|
| 1 | EPIC-J — entity migrations + shared `types` package | [EPIC-J](dev-briefs/v1/EPIC-J-data-requirements.md) | B (foundation) | NOT_STARTED |
| 2 | EPIC-M — design tokens runtime package + UI primitives skeleton | [EPIC-M](dev-briefs/v1/EPIC-M-design-system.md) | B (foundation) | NOT_STARTED |
| 3 | EPIC-N — auth, RBAC, audit-log helper, GDPR-consent helper | [EPIC-N](dev-briefs/v1/EPIC-N-security-gdpr.md) | B (foundation) + C (backend) | NOT_STARTED |
| 4 | Cross-cutting — G1 through G10 CI guards | [_cross-cutting.md §4](dev-briefs/sprint-01/_cross-cutting.md) | Final phase (quality gates) | NOT_STARTED |
| 5 | TDD discipline — base test harness wired into CI | [_tdd-protocol.md](dev-briefs/sprint-01/_tdd-protocol.md) | B (foundation) | NOT_STARTED |

## Out of scope for Sprint 01

Any user-facing surface (EPIC-C, EPIC-G, EPIC-H, EPIC-I and the rest) is deferred to subsequent sprints. The shared packages built in this sprint are the prerequisites for those sprints to start.

## Acceptance for Sprint 01

The sprint is complete when:

- Every entity in master spec Section J has a migration and a corresponding type definition in the shared `types` package.
- Every token in `DESIGN.md` is exposed via the shared `tokens` runtime package.
- The audit-log, notification and GDPR-consent helpers exist and are covered by tests at 100% line and branch.
- All ten CI guards (G1 through G10) reject the canonical violation each one is designed to catch, proven by a deliberate-violation fixture.
- A skeleton end-to-end smoke test runs in CI and passes.

## Stack pre-condition

This sprint cannot start until a stack is chosen (see `CLAUDE.md` section 9). The sprint will land the foundation **in whichever stack** is committed.

## Linked sprint backlog

The next sprint's scope (Sprint 02) is expected to be:

- EPIC-F + EPIC-K backend: property entity API capability set.
- EPIC-C frontend skeleton: portal homepage and one vertical landing page.
- EPIC-O foundation: structured-data emitter, sitemap generator skeleton.

Sprint 02 will be planned in detail at the end of Sprint 01.
