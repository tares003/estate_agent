# @estate/validators

Zod input-validation schemas for **every API capability in master spec §K**, every public/admin form, and every Server Action input.

## One source, two consumers

- **Client** — React Hook Form + the `zodResolver` use these schemas for field-level validation and TS-typed form values.
- **Server** — every Server Action and route handler validates its input through the matching schema; type inference (`z.infer<typeof Schema>`) gives end-to-end safety.

There is no separate Pydantic / Python half — the single-stack monorepo means one schema language across the codebase.

## Compliance rule (guard G5)

Any schema that captures personal data **must** include a `gdpr_consent` affirmation field. The package exposes a `withConsent(schema)` helper and the guard rejects personal-data schemas that omit it.

## Discipline

Every schema ships **positive and negative** tests; pure validators / formatters / sorters also get **property-based** tests (`_tdd-protocol.md` §2). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B2.
