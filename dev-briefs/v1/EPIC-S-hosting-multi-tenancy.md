# EPIC-S — Hosting and multi-tenancy NFRs

**Master spec reference:** Section S (S.1–S.14).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-S-hosting-multi-tenancy.md](../../design-briefs/v1/EPIC-S-hosting-multi-tenancy.md).

## Purpose

Implement the multi-tenancy mechanism, the per-tenant lifecycle, the custom-domain wizard, the per-tenant observability, and the billing-metering infrastructure. The implementation must satisfy the non-functional requirements in master spec Section S without committing to a specific hosting architecture (that decision is recorded in `CLAUDE.md` section 9 when the stack is chosen).

## Functional requirements

- **FR-S-1.** Each platform tenant (agency) shall have an isolated environment with its own primary URL and own administrator credentials, per master spec Section S.1.
- **FR-S-2.** A tenant shall not be able to read or enumerate any data, file or user belonging to another tenant through any interface. Cross-tenant access tests shall be exhaustive across every capability.
- **FR-S-3.** A new tenant signup shall reach a usable administrator login within 10 minutes of authorisation per master spec Section S.5.
- **FR-S-4.** Provisioning shall be fully automated and idempotent. A partial provisioning failure shall be re-runnable to converge.
- **FR-S-5.** Provisioning failure shall alert the operations team within 5 minutes and mark the tenant in a "failed" state.
- **FR-S-6.** Deprovisioning shall be reversible for at least 90 days. After 90 days, deletion shall be permanent.
- **FR-S-7.** Custom-domain support shall be available from launch day. A guided wizard shall walk the tenant through DNS configuration.
- **FR-S-8.** SSL/TLS certificates for custom domains shall be auto-issued and auto-renewed.
- **FR-S-9.** All tenant personal data shall reside in UK or EU regions, per master spec Section S.7.
- **FR-S-10.** The platform shall capture per-tenant usage daily (active listings, media storage, bandwidth egress, outbound email volume) for billing.
- **FR-S-11.** A tenant administrator shall view their current-period usage and projected overage in the admin's billing section.
- **FR-S-12.** Tenant states (provisioning, active, suspended, deprovisioning, deleted, provisioning failed) shall be tracked with audit-trailed transitions.
- **FR-S-13.** Per-tenant logs, metrics and error reports shall be tagged with the tenant identifier and filterable.

## Acceptance criteria

- Provisioning a new tenant takes under 10 minutes end-to-end on a sandbox environment.
- An attempted cross-tenant capability call fails with an authorisation error and is audit-logged.
- A tenant with a custom domain can serve traffic on both the custom domain and the default subdomain.
- A tenant suspended for 30 days, then restored, retains all data and resumes serving traffic.
- A tenant deleted after 90 days has every personal-data field anonymised within the documented window.
- The usage rollup matches the underlying request log within tolerance (±1% on a daily basis).

## Test mapping

```
FR-S-1  → tests/integration/tenant-isolation.test.* (per capability)
FR-S-2  → tests/security/cross-tenant-access.test.* (exhaustive negative)
FR-S-3  → tests/e2e/provisioning-time.spec.*
FR-S-4  → tests/integration/provisioning-idempotency.test.*
FR-S-5  → tests/integration/provisioning-failure-alert.test.*
FR-S-6  → tests/integration/tenant-lifecycle.test.*
FR-S-7  → tests/e2e/custom-domain-wizard.spec.*
FR-S-8  → tests/integration/tls-renewal.test.* (synthetic)
FR-S-9  → tests/integration/data-residency-config.test.*
FR-S-10 → tests/integration/per-tenant-usage-rollup.test.*
FR-S-11 → tests/integration/tenant-billing-view.test.*
FR-S-12 → tests/integration/tenant-state-transitions.test.*
FR-S-13 → tests/integration/tenant-log-tagging.test.*
```

## Dependencies

- The chosen hosting architecture (per master spec Section S.13 — pure hyperscaler, hybrid or self-hosted).
- EPIC-J (data) — the tenant registry.
- EPIC-N (security) — cross-tenant authorisation guarantees.
- EPIC-K (capabilities) — every capability must enforce tenant scoping.

## Open questions

1. Confirm the chosen hosting architecture (Section S.13 — three viable options).
2. Confirm the chosen tenancy pattern (Hybrid + Enterprise upgrade lane is the recommended default per master spec Section S.1).
3. Confirm the chosen billing provider.
4. Confirm the chosen approach to suspended-tenant holding page (CMS-managed, configurable per-tenant).
