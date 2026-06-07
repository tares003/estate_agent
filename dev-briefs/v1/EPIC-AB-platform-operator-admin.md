# EPIC-AB — Platform-operator admin

**Master spec reference:** Section S.3 (tenant registry), Section S.12 (billing), Section H (tenant-side admin is the foil).
**Pack:** Operator (always on for the platform operator; not tenant-facing).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-AB-platform-operator-admin.md](../../design-briefs/v1/EPIC-AB-platform-operator-admin.md).

## Purpose

The **above-tenant** admin used by the SaaS operator (your team) to manage all tenant agencies on the platform. Distinct from EPIC-H (which is the admin a tenant agency's staff use). Tenant agencies never see this surface; this is operator-only.

Currently EPIC-S touches on this in its design brief only — but the surface is large enough to warrant its own brief. It covers tenant lifecycle, billing oversight, suspension tooling, system health, support impersonation, sub-processor disclosure publishing, platform-wide audit, and operator user / role management.

## Functional requirements

- **FR-AB-1.** A platform operator shall sign in at a separate route from tenant admin (recommended: `admin.platformdomain.co.uk`), with mandatory 2FA and additional operator-tier RBAC distinct from tenant roles.
- **FR-AB-2.** A platform operator shall see a tenant directory: every tenant agency with name, slug, plan, status (provisioning / active / suspended / deprovisioning / failed / deleted), primary contact, monthly active usage and current-period billing.
- **FR-AB-3.** A platform operator shall be able to drill into any tenant and see all the screens that tenant's own super-admin sees, in **impersonation mode** with a visible banner indicating impersonation and every action audit-logged with both actor identities.
- **FR-AB-4.** A platform operator shall be able to provision a new tenant manually (e.g. for a tenant onboarded outside the self-serve signup) with the same automated workflow as self-serve signup.
- **FR-AB-5.** A platform operator shall be able to suspend a tenant with a reason from a dropdown (payment failed, ToS breach, security incident, operator request). Suspension preserves data and serves the configured holding page per EPIC-S.
- **FR-AB-6.** A platform operator shall be able to restore a suspended tenant within the 90-day grace period.
- **FR-AB-7.** A platform operator shall be able to deprovision a tenant after the 90-day grace period, triggering the documented permanent-deletion workflow.
- **FR-AB-8.** A platform operator shall see a system-health dashboard: per-region availability, per-shared-component health (database, object storage, email provider, SMS provider), worker run health, recent incidents.
- **FR-AB-9.** A platform operator shall see per-tenant billing: current-period usage, projected overage, invoice history, payment status. Plan changes and billing reconciliation actions are operator-only.
- **FR-AB-10.** A platform operator shall maintain the sub-processor list — adding, editing, removing sub-processors with effective dates and notification toggles. Adding a new sub-processor optionally emails every active tenant.
- **FR-AB-11.** A platform operator shall see platform-wide audit logs (cross-tenant) with strict access control. Cross-tenant audit access is itself audit-logged.
- **FR-AB-12.** A platform operator shall manage operator users and roles, distinct from tenant users and roles.
- **FR-AB-13.** A platform operator shall maintain feature-flag rollout: enable a beta feature for a percentage of tenants, opt specific tenants in or out, view per-tenant flag state.
- **FR-AB-14.** A platform operator shall see incidents: a structured incident log with severity, affected tenants, status, resolution timestamp. Incidents trigger an operator pager when severity reaches a configured threshold.

## User stories

- As a platform operator on call, I want to see at a glance which tenants are healthy and which are not.
- As a support engineer, I want to log into a tenant's admin as their super-admin to reproduce a reported issue, leaving an audit trail.
- As a sales engineer onboarding a large enterprise tenant manually, I want to provision them through the same automated workflow without bypassing safety checks.
- As a compliance officer, I want to add a new sub-processor and notify every tenant in one workflow.
- As an ops manager, I want to roll out a beta feature to 5% of tenants and monitor error rate before enabling for all.

## Acceptance criteria

- Operator sign-in is not reachable from the tenant admin route and vice versa.
- Impersonation actions are always tagged with both actor identifiers in the audit log.
- Tenant lifecycle transitions reject themselves cleanly when preconditions aren't met (e.g. cannot deprovision a tenant in the 90-day grace period).
- The sub-processor list publishes to the public privacy policy page within 60 seconds of an edit.
- Cross-tenant audit-log access requires a Platform Auditor role and is itself audit-logged.
- Feature-flag changes propagate to affected tenants within 60 seconds.

## Test mapping

```
FR-AB-1  → tests/integration/operator-sign-in-isolation.test.*
FR-AB-2  → tests/integration/operator-tenant-directory.test.*
FR-AB-3  → tests/integration/operator-impersonation.test.* (+ audit-log assertions)
FR-AB-4  → tests/integration/operator-manual-provision.test.*
FR-AB-5  → tests/integration/operator-suspend-tenant.test.*
FR-AB-6  → tests/integration/operator-restore-tenant.test.*
FR-AB-7  → tests/integration/operator-deprovision-tenant.test.*
FR-AB-8  → tests/integration/operator-system-health-dashboard.test.*
FR-AB-9  → tests/integration/operator-billing-view.test.*
FR-AB-10 → tests/integration/operator-sub-processor-list.test.*
FR-AB-11 → tests/integration/operator-cross-tenant-audit.test.*
FR-AB-12 → tests/integration/operator-users-and-roles.test.*
FR-AB-13 → tests/integration/operator-feature-flag-rollout.test.*
FR-AB-14 → tests/integration/operator-incidents-log.test.*
Security → tests/security/operator-vs-tenant-isolation.test.* (tenant admin cannot reach operator surfaces)
A11y     → tests/a11y/operator-admin.spec.*
```

## Dependencies

- EPIC-J — `platform.tenants` and the tenant-related auxiliary tables defined in master spec Section S.3.
- EPIC-N — auth, 2FA, audit log, RBAC.
- EPIC-S — tenant lifecycle workflows.
- EPIC-U — worker oversight integration.

## Open questions

1. Confirm the operator-admin route convention (recommended: `admin.platformdomain.co.uk`).
2. Confirm whether the operator admin is multi-region-aware in V1 (recommended: yes if multi-region is in scope, otherwise single-region with a clear "multi-region forthcoming" note).
3. Confirm whether operator users can be tenant users (recommended: no — separate accounts; reduces blast radius).
4. Confirm the policy on emergency tenant access bypassing impersonation (recommended: no — impersonation is the only way in, always audited).
5. Confirm the V1 scope of the incident log — manually-recorded only vs auto-populated from system alerts.
