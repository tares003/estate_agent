# CLAUDE.md — Conventions for AI agents working on this repo

This file is read by AI coding agents (Claude, other tools that follow the convention) to discover the rules of engagement before doing any work.

## 1. Current repo state

This repo is **in the requirements-foundation phase**. No code exists. No stack is committed.

- `Property-Agency-Website-Implementation-Spec.md` is the single source of truth for what the platform must do.
- `PRODUCT.md`, `DESIGN.md`, `motion-spec.md`, `design-requirements.md` carry the cross-cutting rules.
- `dev-briefs/v1/` carries the per-epic dev briefs.
- `design-briefs/v1/` carries the per-epic design briefs.
- `dev-briefs/sprint-01/_cross-cutting.md` carries the migration, shared-package and PR-sequencing rules for the current sprint.
- `dev-briefs/sprint-01/_tdd-protocol.md` carries the TDD discipline.

When a stack is chosen and code begins, add per-app `CLAUDE.md` files under each workspace (e.g. `apps/web/CLAUDE.md`, `services/api/CLAUDE.md`, `packages/shared/CLAUDE.md`) with stack-specific conventions.

## 2. Standing instructions for AI agents

### Do not invent a stack.

The technology choices have not been made. Do not commit to a framework, language, database product, ORM, hosting provider, payment processor, email service, mapping provider, error monitoring tool, analytics tool or CI tool without explicit direction. Section P of the master spec lists the *capabilities* the stack must provide; the agent's role until further notice is to keep requirements implementation-neutral.

### Do not invent product behaviour.

If something is not stated in the master spec or in a brief, ask before implementing. Inventing behaviour silently creates drift between code and requirements that takes weeks to recover.

### Follow PRODUCT.md naming literally.

The canonical-noun table is enforced by lint. Code that names entities differently fails CI. Conversational copy uses the UI-vocabulary table.

### Follow DESIGN.md tokens literally.

No raw hex, no raw px, no raw ms. Every visual value references a token. New tokens require a documented amendment to `DESIGN.md`.

### Follow motion-spec.md for any animation.

Same rule. No magic durations or easings.

### TDD is mandatory.

Read `dev-briefs/sprint-01/_tdd-protocol.md` before writing any code. The RED step is committed separately from the GREEN step. The PR-has-tests CI guard rejects implementation-only diffs.

### Audit-log every state-changing action.

The audit-log-coverage CI guard rejects any state-changing capability that doesn't emit an `audit_logs` row.

### GDPR consent is captured at every personal-data form.

The compliance lint rejects any form schema that captures personal data without a consent affirmation.

### Performance budgets are enforced in CI.

The performance-budget gate rejects any route whose JavaScript or CSS bundle exceeds the budget in `design-requirements.md` section 3.

## 3. Brief-driven work

When the autonomous build prompt runs, every ticket the agent picks up corresponds to a brief under `dev-briefs/v1/<EPIC-ID>.md`. The brief states:

- What the feature is, with reference to the master spec section.
- The functional requirements as numbered FR statements.
- The user stories (As / I want / So that).
- The acceptance criteria.
- The test mapping (what tests, where, what assertions).
- The dependencies on other epics.
- The open questions to resolve before starting.

The matching `design-briefs/v1/<EPIC-ID>.md` carries the visual and interaction specification for the same scope.

The agent's job is to satisfy the brief, not to invent beyond it.

## 4. Working folder layout (when code arrives)

When the stack is chosen, the recommended folder layout is:

```
apps/                     ← user-facing applications
  web/                    ← public marketing site + customer accounts
  admin/                  ← admin dashboard (if separated)
  mobile/                 ← future
services/                 ← back-end services (if separated from apps)
  api/                    ← primary platform API
  workers/                ← background-job workers
packages/                 ← shared code
  types/                  ← shared type definitions
  validators/             ← shared input validation schemas
  ui/                     ← shared UI component library
  config/                 ← shared lint, format and CI rules
  email-templates/        ← shared email-template source
infrastructure/           ← IaC, deployment definitions (added when stack is chosen)
docs/                     ← architecture decisions, runbooks
```

The autonomous prompt's PHASE discovery uses this layout. If the stack chosen mandates a different layout, document the deviation in this file before starting.

## 5. PR conventions

### Branch naming

- Foundation / phase branches: `chore/phase-<letter>-<scope>` (e.g. `chore/phase-b-foundation`).
- Ticket branches inside a phase: `<type>/<EPIC-ID>-<short-slug>` (e.g. `feat/EPIC-G-tenant-repair-form`).
- Bugfix branches: `fix/<EPIC-ID>-<short-slug>`.

### Commit messages

Conventional Commits. One of `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`. Each phase produces at least three commits: `test()` for RED, `feat()` for GREEN, `refactor()` for clean-up (omit if no refactor was needed).

Include a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer (or the actual model identifier of whichever AI assisted) on commits where an AI contributed substantively.

### PR shape

One PR per phase as described in the autonomous build prompt. PR description must reference the brief IDs being closed and the audit-report row IDs being resolved.

### PR checks (when CI is set up)

- Type-check passes.
- Lint passes (including the project-specific lint rules described in `dev-briefs/sprint-01/_cross-cutting.md`).
- All tests pass.
- Coverage threshold met (per `_tdd-protocol.md` section on coverage gates).
- Performance budget met for affected routes.
- PR-has-tests guard satisfied (no implementation diff without test diff).
- Audit-log-coverage guard satisfied for any new state-changing capability.

## 6. When the agent is blocked

Follow the blocker policy in the autonomous build prompt:

1. Commit progress on the phase branch.
2. Write the blocker to `.claude/master-prompt-log.md` with enough detail for a human to resume.
3. Continue with the next phase if possible.
4. Pause subsequent phases that depend on a foundation-level blocker.

## 7. Files the agent must not touch without explicit instruction

- `PRODUCT.md` (naming conventions and tier model are business decisions).
- `DESIGN.md` (design tokens are owned by design — additions only via amendment).
- The master spec `Property-Agency-Website-Implementation-Spec.md` (requirements are the input, not the output, of the agent's work).
- Any file under `.claude/` other than `master-prompt-log.md` and `discovery-summary.md`.

## 8. Notes on AI-generated content

- Any user-facing copy generated by an AI assistant must be reviewed by a human before shipping.
- Any AI-generated property description shown to end-users must be flagged on the admin side per `PRODUCT.md` section 8.
- AI-generated test data (seed scripts) is fine to ship without review, but must use deterministic fixtures so that re-runs are stable.

## 9. Stack — RECORDED

The stack has been chosen. Code may now be committed. The choices below are the **authoritative** answers; subsequent additions or substitutions require an amendment PR against this file.

### Architecture pattern — hybrid two-stack

The product is built as two cooperating applications sharing one database and one design system:

- **A Django + Wagtail "content" application** serving the content-heavy surfaces (public marketing site, agency editorial content, CMS page builder, knowledge hub, the platform's own marketing site).
- **A Next.js "a