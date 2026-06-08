# @estate/observability

Structured logging and the swap-ready error-reporting interface.

## Logging

`pino` configured for JSON output to stdout, captured by the Docker logging driver. Helpers:
- `logger.info(msg, fields)` — info-level structured log.
- `logger.error(err, fields)` — error-level with stack trace + structured context.
- `logger.child({ tenantId, userId, requestId })` — per-request logger threaded through Server Actions and route handlers.

## Error reporting

`ErrorReporter` interface. V1 default is a no-op (`NoopErrorReporter`); structured logs are sufficient for V1 (master spec §S.13a). The interface preserves the swap path:
- `SentryErrorReporter` — Sentry-hosted.
- `GlitchTipErrorReporter` — self-hosted on the same Hetzner box.

Selected via `ERROR_REPORTER=noop|sentry|glitchtip` env.

## Discipline

The no-op default ships with a fixture asserting it doesn't throw on any input. The Sentry/GlitchTip implementations ship behind an integration test that exercises the breadcrumb + transaction APIs. Coverage gate: **100% line + branch** on the no-op path; integration-tested on the others.

Status: **skeleton** — built in Phase B0 (foundation).
