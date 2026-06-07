# @estate/validators

Input-validation schemas for **every API capability in master spec §K** and every public/admin form.

## Two halves, one contract

- **TypeScript (Zod)** — used by `apps/next` for client + edge validation.
- **Python (Pydantic)** — used by `services/django` for server validation (and as the Django Ninja request/response models).

Both are kept consistent against **one OpenAPI contract** (the Django-emitted spec). A CI step regenerates and diffs them so neither side drifts.

## Compliance rule (guard G5)

Any schema that captures personal data **must** include a `gdpr_consent` affirmation field. The package exposes a `withConsent(schema)` helper and the guard rejects personal-data schemas that omit it.

## Discipline

Every schema ships **positive and negative** tests; pure validators/formatters/sorters also get **property-based** tests (`_tdd-protocol.md` §2). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B2.
