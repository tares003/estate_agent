# EPIC-AB — Platform-operator admin (design)

**Dev brief:** [dev-briefs/v1/EPIC-AB-platform-operator-admin.md](../../dev-briefs/v1/EPIC-AB-platform-operator-admin.md).
**Pack:** Operator (always on for the platform operator; not tenant-facing).
**Status:** NOT_STARTED.

## Surfaces affected

- `/operator/sign-in` (with mandatory 2FA enrolment after first sign-in).
- `/operator` (system-health dashboard).
- `/operator/tenants` (tenant directory).
- `/operator/tenants/[id]` (per-tenant detail with impersonation entry point).
- `/operator/billing` (cross-tenant billing oversight).
- `/operator/sub-processors`.
- `/operator/audit` (cross-tenant audit log).
- `/operator/users` (operator users and roles).
- `/operator/feature-flags`.
- `/operator/incidents`.

## Visual identity

The operator admin uses a deliberately distinct visual identity from tenant admin so that an operator working across both surfaces cannot confuse them:

- Sidebar background is the dark `--colour-brand-primary` rather than the neutral `--colour-surface-sunken` used in tenant admin.
- Header includes a persistent "Platform operator" tag.
- The impersonation banner (when impersonating a tenant's super-admin) is bright `--colour-warning` background with high-contrast text, full width, with "Exit impersonation" CTA.

## Layout patterns

### System-health dashboard

- Top row: per-region availability tiles with last-24h uptime percentage.
- Second row: per-shared-component health (database, object storage, email provider, SMS provider) with green/amber/red.
- Worker run health: chart of last-24h worker outcomes across all tenants.
- Recent incidents (last 7 days) with severity tags.
- Top-10-tenants-by-error-rate widget.

### Tenant directory

- Filterable table: name, slug, plan, status badge, monthly active usage, current-period revenue, primary contact, days since signup.
- Quick filters: All / Active / Suspended / Failed / Trial.
- Bulk actions: Suspend / Restore / Notify / Export.
- "+ New tenant" CTA for manual provisioning.

### Per-tenant detail page

- Header: tenant name + status pill + plan + "Enter as super-admin" CTA (impersonation).
- Tabs: Overview / Usage / Billing / Lifecycle / Incidents / Audit / Settings.
- Overview: recent activity, provisioning history, support ticket count, custom-domain status, primary contact.
- Usage: per-metric current-period and last-12-months charts.
- Billing: invoice history, payment status, plan-change controls.
- Lifecycle: state-transition controls (Suspend, Restore, Deprovision) with reason capture.
- Incidents: per-tenant incident log.
- Audit: per-tenant audit log.
- Settings: tenant-level overrides (sub-processor opt-outs, feature-flag forced states).

### Sub-processor list

- Table: name, category (storage / email / SMS / analytics / etc.), country, effective from, effective until, notification status.
- "+ Add sub-processor" wizard: name, purpose, country, DPA reference, "notify all active tenants" toggle.

### Feature-flag rollout

- Per-flag card: name, description, current rollout percentage, per-tenant overrides (allowlist / blocklist), beta-tester pool size.
- "Increase rollout" stepper with confirmation.
- Per-flag analytics: error rate among enabled vs disabled tenants, opt-in rate.

### Incidents log

- Reverse-chronological list with severity tags (P0 / P1 / P2 / P3).
- Per-incident detail: affected tenants list, root cause notes, resolution timestamp, post-mortem link.

### Impersonation banner

- Persistent banner across every screen during an impersonation session.
- "Impersonating: [Super Admin] at [Tenant Name]" + "Exit impersonation" CTA.
- All actions logged with both actor identifiers.

## Component inventory

`OperatorSignInPage`, `OperatorShell`, `OperatorSidebar`, `OperatorTopbar`, `OperatorSystemHealthDashboard`, `OperatorTenantDirectory`, `OperatorTenantDetail`, `OperatorBillingView`, `OperatorSubProcessorList`, `OperatorAuditLog`, `OperatorUsersAndRoles`, `OperatorFeatureFlagsView`, `OperatorIncidentsLog`, `ImpersonationBanner`, `TenantLifecycleControls`, `TenantStatusPill`. Built on EPIC-L primitives with operator-tier visual identity overrides.

## State variations

- **System-health all green:** subtle green sash on the dashboard header.
- **One or more incidents open:** prominent banner with "X open incident(s)" link.
- **Tenant in failed provisioning:** card with red border and "Investigate" CTA on the tenant directory.
- **Suspended tenant within grace period:** amber pill plus "Restore by [date]" caption.
- **Suspended tenant past grace period:** red pill plus "Eligible for deletion".
- **Feature-flag rollout in progress:** stepper shows current percentage with planned next step and timestamp.

## Accessibility specifics

- The impersonation banner has `role="alert"` and is announced on entry.
- Lifecycle action confirmations require typed confirmation for irreversible actions (Suspend, Deprovision).
- Status pills use `aria-label` carrying full status name.
- System-health tiles include numeric uptime alongside the colour.

## Responsive

- Operator admin is desktop-focused. On mobile, it works for read-only oversight; destructive actions are disabled below `--breakpoint-md` with a "Use a desktop to perform this action" prompt.

## Motion

- Operator admin minimises animation to reinforce the seriousness of the surface.
- The impersonation banner does not animate — it is always present and unmissable.

## Token references

- Operator sidebar background: `--colour-brand-primary`.
- Impersonation banner background: `--colour-warning`.
- Severity tags: P0 `--colour-danger`, P1 `--colour-warning`, P2 `--colour-info`, P3 `--colour-text-muted`.

## Open design questions

1. Confirm whether operator admin allows multi-region oversight in V1.
2. Confirm the impersonation entry UX (single click vs typed confirmation — recommended: typed confirmation).
3. Confirm whether the system-health dashboard is the default landing or whether the tenant directory is (recommended: system health, since operators check that first).
4. Confirm whether tenant detail's "Settings" tab can override tenant-side settings (recommended: yes for emergency operator intervention, audit-logged).

## Pack-state behaviour

Per `design-requirements.md` §2a — this brief is owned by the Operator scope (always on for the platform operator; not tenant-facing).

The platform-operator admin **manages** pack state across tenants and therefore has its own pack-aware surfaces that supplement EPIC-AD's tenant-side design:

- **Per-tenant Packs tab** (covered in EPIC-AD design brief but referenced here for completeness): the operator sees a per-tenant pack matrix with current state, trial status, billing total, and the "Enable on tenant's behalf" affordance for support intervention.
- **Cancellation queue**: lists pending pack-cancellation requests with reason, requested-at, tenant primary contact. Processing flow: review reason → confirm by email → execute disable → write audit-log entry with operator identifier.
- **Per-pack adoption dashboard**: aggregate analytics — total active per pack, churn per pack, trial-to-paid conversion per pack, support-ticket count per pack. Helps the operator prioritise pack investment.
- **Forced-state controls** (emergency operator intervention): can temporarily force a pack on / off for a specific tenant outside the normal lifecycle (e.g. enable bulk_import temporarily for a tenant whose paid period has lapsed mid-import). Every forced-state action requires typed confirmation and writes an audit-log entry.
