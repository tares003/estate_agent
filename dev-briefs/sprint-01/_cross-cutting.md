# Sprint 01 — Cross-cutting requirements

This document captures the rules that apply across **every** epic in this sprint. It is the input to PHASE B (foundation bulk PR) of the autonomous build prompt. Per-epic briefs reference it for shared structure rather than duplicating these rules.

## 1. Definition of done (universal)

A piece of work is "done" only when **all** of the following are true for it. Per-brief acceptance criteria layer **on top of** these — they do not replace them.

1. Every functional requirement in the brief is demonstrated by an automated test.
2. The work passes type-check, lint and all tests in CI.
3. Test coverage for any touched file meets or exceeds the threshold in `_tdd-protocol.md`.
4. **Every visual artefact is verified responsive at every breakpoint defined in `DESIGN.md` §10** — 320 px, 640 px, 768 px, 1024 px, 1280 px, 1440 px and 2560 px. Mobile-first markup. No hover-only interactions. The responsive-coverage CI guard (G11 — see §4 below) rejects PRs whose component or page tests do not include a viewport assertion per breakpoint.
5. Any new or changed personal-data form captures a GDPR consent affirmation per `PRODUCT.md` section 6.
6. Any new or changed state-changing capability emits an audit-log entry.
7. Any new public-facing surface meets the accessibility requirements in `design-requirements.md` section 1, verified **at every breakpoint** by automated and manual checks.
8. Any new public-facing route meets the performance budget in `design-requirements.md` section 3 **at every viewport**, verified by the performance-budget CI gate on mobile and desktop simulated profiles.
9. Any new colour, spacing, radius or motion value is sourced from a token in `DESIGN.md` or `motion-spec.md` — verified by the token-enforcement lint.
10. Any new entity reference in code obeys the canonical-noun table in `PRODUCT.md` section 2 — verified by the naming lint.
11. Any new or changed user-facing copy follows the brand-voice rules in `PRODUCT.md` section 7 and uses the UI vocabulary in section 4.
12. The change is documented for engineers (in-repo) and, where it affects staff workflow, in the admin help content.
13. The PR description references the brief IDs being closed and the audit-report row IDs being resolved.

## 2. Foundation shared packages (PHASE B scope)

The following shared packages must exist before any feature work begins. Each is built TDD-first with 100% coverage gate.

| Shared package | Purpose | Public surface |
|---|---|---|
| **Validators** | Input validation schemas for every API capability defined in master spec Section K. | Schema object per capability, with positive and negative tests. |
| **Types** | The canonical type definitions for every entity defined in master spec Section J. | Type aliases / interfaces consumed by both API and UI. |
| **Tokens** | Runtime accessor for the design tokens declared in `DESIGN.md`. | Object exposing `colour`, `space`, `radius`, `motion`, `text`, etc. |
| **i18n** | Translation-key registry and runtime accessor. | `t(key, args)` function and a `defineMessages(...)` helper. |
| **UI primitives** | Atoms used by every higher-level component: Button, TextField, EmailField, PhoneField, NumberField, Select, Combobox, DatePicker, TimeSlotSelector, Checkbox, Radio, Modal, Drawer, Toast, Tooltip, Popover, Dropdown, Tabs, Accordion, Skeleton, Avatar, Badge, Icon, Pagination, Breadcrumbs, AntiSpamChallenge, FileDropzone, MultiStepForm, FormReviewSummary, FormError, FormSuccess. | Component per atom with story-level documentation. |
| **Audit log helper** | Standard wrapper that mutating handlers call to emit an `audit_logs` row. | `audit({actor, action, entity, entity_id, diff})` function. |
| **Notification helper** | Standard wrapper for outbound notification emission per master spec Section H.13 matrix. | `notify(event, payload)` function. |
| **GDPR consent helper** | Records a consent timestamp on personal-data form submission. | `recordConsent(scope, payload)` function. |

## 3. Migrations / schema changes needed in PHASE B

Every entity defined in master spec Section J must have a migration created in PHASE B, **even though no API or UI consumes them yet**. The schema lands first; the consumers land in their respective epic PRs.

The migration set covers:

- Authentication and access entities (J.1).
- Branches and agents (J.2).
- Property catalogue (J.3, F).
- Leads and CRM (J.4).
- Contacts (J.5).
- Repairs (J.6, G).
- Content management (J.7).
- Cross-cutting audit_logs, notification_log, consent_logs, settings, search_logs.

Migrations are written so they can run in any order respecting their foreign-key dependencies. Each migration has a corresponding down-migration test that verifies it can be safely rolled back.

## 4. Universal CI guards to implement

Each guard is one CI workflow. Each has a corresponding test that proves the guard rejects the violation it's designed to catch.

### G1 — PR-has-tests guard

Rejects any PR whose diff touches files matching `**/{src,app,pages,components,routes,handlers}/**` without also touching files matching `**/*.{test,spec}.*` or `**/__tests__/**`. Allows test-only PRs to pass.

### G2 — Coverage threshold guard

Reads coverage from the test runner output and fails the workflow if coverage on touched files drops below the threshold in `_tdd-protocol.md` section 5.

### G3 — Performance budget guard

For each public route changed by the PR, builds the route in production mode, measures gzipped JavaScript and CSS bundle sizes, and fails the workflow if the budget in `design-requirements.md` section 3 is exceeded.

### G4 — Audit-log coverage guard

Statically analyses every state-changing handler in the diff and requires either a call to the audit-log helper or a documented exemption comment. Fails if neither is present.

### G5 — GDPR consent guard

Statically analyses every public form schema in the diff. Fails if a schema captures personal data without a `gdpr_consent` field.

### G6 — Naming guard

Statically analyses identifiers in the diff against the canonical-noun and forbidden-noun tables in `PRODUCT.md` section 2 and 3. Fails if a forbidden alternative is found.

### G7 — Design-token guard

Statically analyses styling files in the diff. Fails if a hex colour, pixel value, millisecond value or easing function is hardcoded where a token exists.

### G8 — Trust-marker guard

Statically analyses public surfaces that render a price, valuation result, rent figure, calculator output, review widget or AI-generated copy. Fails if the corresponding trust marker required by `PRODUCT.md` section 8 is missing.

### G9 — Accessibility smoke guard

Runs an automated accessibility check on every new public route added in the diff and fails on any AA violation.

### G10 — Sub-processor manifest guard

Fails if the diff adds a runtime dependency that calls an external service without that service appearing in the published sub-processor list.

### G11 — Responsive-coverage guard

For every component test and every page test in the diff, requires assertions at each of the seven defined viewports (320, 640, 768, 1024, 1280, 1440, 2560 px). Fails if any breakpoint is unasserted. A test surface may opt out per assertion with an explicit `responsive-coverage: opt-out reason` comment (used sparingly — e.g. operator admin destructive controls explicitly disabled below `--breakpoint-md`). The CI publishes a coverage map per PR showing which surfaces are responsive-verified at which breakpoints.

## 5. PR sequencing within the sprint

PRs must be opened and merged in this order:

1. **Phase A — Audit PR** (chore/phase-a-audit). Opens as draft, no merge required.
2. **Phase B — Foundation PR** (chore/phase-b-foundation). Must be merged before any shell PR begins.
3. **Phase C — Backend PR** (chore/phase-c-backend). Implements the API capability set for every epic.
4. **Phase D — Web PR** (chore/phase-d-web). Implements the public site, customer account and admin shell.
5. **Phase E — Cross-shell PR** (chore/phase-e-cross-shell). Implements integrations and CRON workers.
6. **Final Phase — Quality gates PR** (chore/final-quality-gates). Implements G1 through G10.

If multiple shells are in scope (e.g. a separate mobile app), add Phase letters in dependency order.

## 6. Internationalisation requirement

Even though only English (`en-GB`) is shipped in V1, every piece of user-facing text in every shell must be sourced from a translation key. Inline string literals fail the i18n lint.

## 7. Telemetry baseline

Every public-facing form submission must emit a structured analytics event with at least: form slug, lead type, source page, source campaign, success outcome, anonymous session identifier. Events are routed via the analytics capability defined in master spec Section P.

Every admin action must emit a similar event with: actor user identifier, action, entity, entity identifier.

The event names follow `subject.verb` casing (e.g. `enquiry.submitted`, `property.published`).

## 8. Documentation requirements

- Every shared package must ship a README explaining what it does, its public surface, and how to extend it.
- Every CI guard must ship a one-page explainer in `docs/ci-guards/<guard-id>.md` describing what it catches and how to satisfy it.
- The README at the repo root must list every shared package and every CI guard with a on