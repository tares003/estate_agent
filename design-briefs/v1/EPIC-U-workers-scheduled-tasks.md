# EPIC-U — Background workers and scheduled tasks (design)

**Dev brief:** [dev-briefs/v1/EPIC-U-workers-scheduled-tasks.md](../../dev-briefs/v1/EPIC-U-workers-scheduled-tasks.md).
**Master spec reference:** Section H.23.
**Pack:** Core (individual workers may be pack-specific per EPIC-AD).
**Status:** NOT_STARTED.

## Surfaces affected

Workers themselves have no UI. The only design surfaces are:

- Admin scheduled-tasks console (`/admin/scheduled-tasks`).
- Per-worker detail page.
- Worker failure alert in the dashboard alerts panel.
- The emails and SMS messages workers produce (handled in their owning epics' email-template editors).

## Scheduled-tasks console (`/admin/scheduled-tasks`)

- Table columns: Worker name, Description, Cadence, Last run (relative time), Outcome, Average runtime, Next run, Status (running / idle / paused / failing), Actions.
- Outcome icon: green tick for success, amber for partial, red for failure, grey clock for "not yet run".
- Actions per row: Run now, View log, Pause / Resume.
- Filter chips: All / Running / Failing / Paused.
- Saved-view dropdown.

## Per-worker detail page

- Header: worker name, description, cadence, status badge.
- Recent runs table: timestamp, duration, outcome, summary, link to log.
- Run-history chart (last 30 runs as a small bar chart of duration; bar colour reflects outcome).
- "Force run" button with confirmation.
- "Pause" / "Resume" toggle with audit-log entry.
- Tenant-scope toggle (Super admin only): view runs for a specific tenant.

## Failure alert (in dashboard alerts panel)

- Alert title: "Worker `saved_search_alerts_daily` failed for 3 tenants overnight".
- Body: short summary, list of affected tenants (linkable), "View log" CTA.
- Acknowledge action that removes the alert from the panel but keeps it in the log.

## Component inventory

`ScheduledTasksTable`, `WorkerStatusBadge` (idle / running / paused / failing), `WorkerRunHistoryChart`, `WorkerDetailPage`, plus shared primitives.

## State variations

- **No runs yet:** "This worker hasn't run yet — next scheduled run: [time]". Disable "View log" and the chart.
- **All runs green for 30 days:** small "30-day streak" caption (subtle, not gamified).
- **Paused:** clear visual treatment so the operator knows the worker isn't running.
- **Failing repeatedly:** red status badge with a "Failing for 3 consecutive runs" caption and prominent "View latest error" CTA.

## Accessibility

- Status badge has `aria-label` describing status verbatim.
- Run-history chart has a textual fallback summary ("30 runs, 28 successful, 2 failed").
- Pause / Resume toggle uses a real switch component with clear on/off state.

## Responsive

- Table converts to stacked cards below `--breakpoint-md`. Each card shows worker name, last run, outcome, next run.
- Worker detail page stacks vertically below `--breakpoint-lg`.

## Motion

- Status badge has no animation in idle. A subtle pulse appears on "running" state per `motion-spec.md` reduced-motion rules.
- Run-history chart bars animate up on initial load over `--motion-duration-slow` (single play; disabled under reduced motion).

## Token references

- `--colour-success`, `--colour-warning`, `--colour-danger` for outcome states.
- `--colour-text-muted` for "not yet run" placeholder text.
- `--radius-md` for chart bars and status pills.

## Open design questions

1. Confirm whether per-tenant run drill-down is in V1 admin (recommended: yes for super admin only).
2. Confirm whether the run-history chart shows duration or success-rate (recommended: duration with colour-coded outcome).
3. Confirm the cadence-display format ("Daily 07:00" vs cron syntax) — recommended: human-readable.
