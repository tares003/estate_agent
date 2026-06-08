# apps/workers

The BullMQ worker process. Same TypeScript codebase as `apps/web`, started with a different entrypoint. Consumes the shared Redis queue.

## Queues (added per epic)

- **scheduled-tasks** (EPIC-U) — cron-driven jobs: nightly portal sync, weekly vendor reports, compliance-expiry alerts, etc.
- **email-send** — async `nodemailer` send via the tenant's resolved SMTP credentials.
- **portal-syndication** (EPIC-V) — outbound feeds to Rightmove / Zoopla / OnTheMarket (when the `portal_syndication` pack is enabled).
- **bulk-import** (EPIC-X) — CSV/XML imports from established UK CRMs (when the `bulk_import` pack is enabled).
- **report-generation** — pivot-style custom reports + scheduled report delivery.
- **feedback-aggregation** (EPIC-AC) — re-compute league tables, refresh public reviews badge.

## Multi-tenancy

Every job carries a `tenantId`. The worker resolves the tenant context and applies the same `SET LOCAL app.current_tenant_id` extension that `apps/web` uses; RLS policies apply identically.

## Discipline

Every queue handler ships with: a Vitest integration test (queue-in / DB-out), an idempotency assertion (a job replayed must not double-effect), and an `audit()` call for any state-changing job (G4). Coverage gate: 100% on shared-package code paths.

Status: **scaffold** — queues land with their owning epic.
