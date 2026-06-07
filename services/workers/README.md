# services/workers — Celery workers

Celery worker processes. **Runs the same `services/django` codebase** with a worker entrypoint (no duplicated business logic); deployed as a separate container per `AGENTS.md` §9.

## Worker catalogue (EPIC-U — built in Phase B12)

`saved_search_alerts_*`, `sitemap_regenerate`, `expired_property_archive`, `compliance_alert_scan`, `recurring_maintenance_generator`, `retention_purge`, `notification_log_purge`, `audit_log_cold_storage`, `daily_usage_rollup`, `weekly_digest_email`, … 

## Rules

- **Per-tenant fan-out is filtered by pack entitlement** (guard G12) — a worker only does pack-dependent work for tenants whose pack is enabled.
- Each worker sets the tenant RLS GUC before touching tenant data.
- Time and randomness are injected (testable; `_tdd-protocol.md` §8). Coverage gate: **90% line / 80% branch** (CRON/workers).

Status: **skeleton** — broker (Redis) + Celery app configured with the Django project in Phase B2; the worker catalogue lands in B12.
