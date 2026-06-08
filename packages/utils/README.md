# @estate/utils

Cross-cutting runtime helpers that don't fit any single feature package.

## Exports

- **`audit(event, actor, target, diff)`** — emits an `audit_logs` row with full diff + actor + IP + user-agent. Called by every state-changing capability (CI guard G4). Paired with the Prisma `audit-log` extension in `packages/db`.
- **`notify(recipient, channel, template, data)`** — fan-out to the user's configured notification channels (email / SMS / in-app). Consults the per-channel preferences set in the user profile.
- **`recordConsent(userId, formId, version, consents)`** — captures the GDPR consent at form-submit time (CI guard G5). Stores the consent row, the schema version, and the IP + UA for the audit trail.
- **`hashSensitive(value)`** — deterministic hash for secondary indexes on sensitive data (e.g. email hashes for duplicate detection without storing plaintext).
- **`maskPii(value)`** — render-time PII masking for log lines and admin diagnostics.

## Discipline

Every helper ships with property-based tests (idempotency, deterministic output, no plaintext leakage). Coverage gate: **100% line + branch**.

Status: **skeleton** — built in Phase B0 (foundation).
