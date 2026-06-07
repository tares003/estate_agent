# EPIC-U — Background workers and scheduled tasks

**Master spec reference:** Section H.23 (admin scheduled-tasks console), Section P.1 (background-job capability), cross-cutting references in EPIC-G / EPIC-I / EPIC-N / EPIC-O.
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-U-workers-scheduled-tasks.md](../../design-briefs/v1/EPIC-U-workers-scheduled-tasks.md).
**Phase ownership:** Phase E (cross-shell) of the build roadmap.

## Purpose

Implement the platform's background-job layer — the scheduled cron workers, the queue-driven workers, the retry policies, the per-tenant scoping, the observability, and the admin scheduled-tasks console (master spec Section H.23). Workers are referenced by every other epic but owned by none of them; this brief gives them a single home.

## The worker catalogue

The platform ships with the following workers in V1. New workers added in later sprints inherit the same pattern.

| Worker | Cadence | Owning epic | Purpose |
|---|---|---|---|
| `saved_search_alerts_daily` | Daily 07:00 (tenant-local) | EPIC-I / EPIC-T | Send digest of new matches per saved search at frequency=daily. |
| `saved_search_alerts_weekly` | Weekly Monday 08:00 | EPIC-I / EPIC-T | Same for frequency=weekly. |
| `saved_search_alerts_instant` | Triggered on `property.published` | EPIC-I / EPIC-T | Send immediate match notification for frequency=instant. |
| `sitemap_regenerate` | Triggered on `property.published`, `property.unpublished`, `page.published`, `area_guide.published`, `blog_post.published`; and as a safety net every 6 hours | EPIC-O | Rebuild sitemap children and ping search engines. |
| `portal_feed_push` | Every 30 min | EPIC-V | Generate and push outbound portal feed (deferred to Phase 7). |
| `expired_property_archive` | Daily 02:00 | EPIC-F | Move properties whose `market_status` reached `sold` or `let` more than 90 days ago into archived state. |
| `compliance_alert_scan` | Daily 01:00 | EPIC-H / EPIC-N | Surface gas safety, EICR, EPC, deposit-protection items expiring within 30 days. |
| `recurring_maintenance_generator` | Daily 02:30 | EPIC-G | Auto-create recurring repair tickets (annual gas safety, EICR, PAT) at configured lead time before due date. |
| `retention_purge` | Daily 03:00 | EPIC-N | Anonymise records past their configured retention window. |
| `notification_log_purge` | Weekly Sunday 04:00 | EPIC-N | Purge `notification_log` entries past 90 days (compress to aggregate stats). |
| `search_log_purge` | Weekly Sunday 04:30 | EPIC-N | Purge `search_logs` past 13 months. |
| `audit_log_cold_storage` | Monthly 1st 05:00 | EPIC-N | Move `audit_logs` older than 12 months to cold storage; retain queryable index. |
| `backup_database` | Daily 03:30 | EPIC-S | Trigger or verify the daily logical database snapshot per tenant retention requirement. |
| `weekly_digest_email` | Mon 08:00 | EPIC-I | Send branch-manager digests of the past week's leads, viewings, repairs. |
| `daily_usage_rollup` | Daily 04:00 | EPIC-S | Aggregate per-tenant usage metrics for billing. |
| `acm_certificate_renewal_poll` | Daily 06:00 | EPIC-S | Verify custom-domain TLS certificates are renewing. |
| `alert_scan_hourly` | Hourly | EPIC-H | Generate dashboard alerts (overdue follow-ups, SLA risk, unassigned leads). |
| `link_health_check` | Weekly | EPIC-E / EPIC-O | Detect broken privacy-policy links and redirect targets. |
| `subscriber_double_optin_reminder` | Daily 10:00 | EPIC-C | Send reminder to subscribers in `pending` state for more than 7 days; purge after 30. |

## Functional requirements

- **FR-U-1.** A worker shall execute in a context that has access to the same shared packages (`audit`, `notify`, `consent`, `validators`, `types`) as the request-handling layer.
- **FR-U-2.** A worker that touches tenant data shall do so with the correct per-tenant authorisation context — never with a global admin context.
- **FR-U-3.** A worker shall declare its cadence (cron expression or event trigger), its timeout, its retry policy, and the channel for failure alerts.
- **FR-U-4.** A worker shall be idempotent — re-running it (or running it twice in parallel due to a scheduler bug) shall not cause double effects.
- **FR-U-5.** A worker shall emit a structured `worker.<name>.run` event on start, success, failure and partial-failure, with the tenant identifier where applicable.
- **FR-U-6.** A worker failure shall not crash the worker process. Retries follow exponential backoff with a configured maximum.
- **FR-U-7.** The admin console (master spec Section H.23) shall list every worker with last-run timestamp, last-run outcome, next-run time, average runtime and a "Run now" button.
- **FR-U-8.** A worker shall be pause-able from the admin without redeploy. Paused workers do not run; the admin alert panel surfaces the pause.
- **FR-U-9.** A worker's per-tenant work shall be scheduled in the tenant's local time zone where the cadence is "daily" or "weekly".
- **FR-U-10.** A new worker can be added by a developer via a single-file declaration; the scheduled-tasks console picks it up automatically.

## User stories

- As a property manager, I want to see at a glance that overnight workers ran successfully so I know the alerts that should have gone out, did.
- As an on-call engineer, I want to pause a misbehaving worker without redeploying.
- As a developer, I want to add a new scheduled task by writing one file rather than threading through three subsystems.
- As a tenant administrator, I want my saved-search alerts to arrive at 7am my time, not the platform operator's time.

## Acceptance criteria

- Every worker in the catalogue has a corresponding implementation file and a corresponding test file.
- A deliberate failure-injection test confirms that retries follow the declared policy.
- A deliberate concurrent-run test confirms idempotency.
- The admin scheduled-tasks console reflects the catalogue without manual entry.
- An end-to-end test confirms a saved-search-alert worker emits the expected emails for a seeded dataset.
- A deliberate cross-tenant data-touching test confirms tenant isolation is preserved.

## Test mapping

```
FR-U-1  → tests/integration/worker-shared-packages.test.*
FR-U-2  → tests/security/worker-tenant-isolation.test.* (per worker that touches tenant data)
FR-U-3  → tests/unit/worker-declaration.test.*
FR-U-4  → tests/integration/worker-idempotency.test.* (per worker)
FR-U-5  → tests/integration/worker-events.test.*
FR-U-6  → tests/integration/worker-retry-policy.test.*
FR-U-7  → tests/integration/scheduled-tasks-console.test.* (already partly in EPIC-H)
FR-U-8  → tests/integration/worker-pause.test.*
FR-U-9  → tests/integration/worker-tenant-timezone.test.*
FR-U-10 → tests/integration/worker-discovery.test.*
Regression → tests/regression/EPIC-U/EPIC-U-saved-search-alerts.regression.test.*
```

## Dependencies

- EPIC-J — every entity the workers touch.
- EPIC-N — shared audit, notify, consent helpers; retention purge logic.
- EPIC-K — capabilities the workers invoke internally where applicable.
- EPIC-S — per-tenant authorisation context; per-tenant time-zone resolution.

## Open questions

1. Confirm the worker runtime model — long-running daemon vs serverless function vs container per invocation. (Deferred to stack choice.)
2. Confirm the queue / event bus mechanism for event-triggered workers.
3. Confirm the policy on alerting when a daily worker is missed (e.g. the scheduler itself was down).
4. Confirm whether a worker's per-tenant fan-out is concurrent (parallel) or sequential (serial) by default.
5. Confirm the cap on retry attempts before the worker is marked failed-permanent and pages the on-call engineer.
