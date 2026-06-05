# EPIC-K — Interface capabilities

**Master spec reference:** Section K (K.1–K.5).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-K-interface-capabilities.md](../../design-briefs/v1/EPIC-K-interface-capabilities.md).

## Purpose

Implement every capability described in master spec Section K — public, customer, administrative and outbound integration — using the shared validators and types from EPIC-J. The capability surface is implementation-neutral; the protocol (REST, GraphQL, server actions) is the team's choice once the stack is committed.

## Functional requirements

- **FR-K-1.** Every capability listed in master spec Section K.1 (public) shall be implemented with the documented inputs and outputs.
- **FR-K-2.** Every capability listed in master spec Section K.2 (customer) shall require an authenticated customer session.
- **FR-K-3.** Every capability listed in master spec Section K.3 (administrative) shall require authentication and the relevant permission, scoped by branch where the permission is branch-scoped.
- **FR-K-4.** Every outbound webhook listed in master spec Section K.4 shall be HMAC-signed with the receiver's configured secret.
- **FR-K-5.** Every inbound webhook listed in master spec Section K.5 shall verify the provider's signature before processing.
- **FR-K-6.** Every state-changing capability shall write an audit-log entry via the shared audit helper.
- **FR-K-7.** Every capability that accepts personal data shall verify the GDPR consent affirmation per the shared consent helper.
- **FR-K-8.** Every capability shall validate input against the shared validator schema before processing; rejection messages shall be machine-readable but not leak personal data.
- **FR-K-9.** Public capabilities shall be rate-limited per the configured rate-limit table (default: 5 req/min/IP for enquiries, 10/min/IP for auth, 20/min/IP for newsletter).
- **FR-K-10.** File-upload capabilities shall use pre-signed direct upload URLs; the application server shall never proxy media bytes.
- **FR-K-11.** Authorisation checks shall be enforced at the data layer (e.g. RBAC clause on the storage query), not solely at the interface boundary.

## Acceptance criteria

- Every capability has a contract test (a single assertion that pins the request and response shape).
- Public capabilities can be exercised end-to-end against the live server in CI smoke tests.
- Customer capabilities reject requests without a valid session.
- Administrative capabilities reject requests without the required permission.
- Cross-tenant capability calls (when the platform is operating multi-tenant) cannot read other-tenant data even when the calling user is authenticated as a different tenant's super-admin.

## Test mapping

```
FR-K-1  → tests/contract/public.test.* (per capability)
FR-K-2  → tests/contract/customer.test.* (per capability)
FR-K-3  → tests/contract/admin.test.* (per capability)
FR-K-4  → tests/integration/outbound-webhooks.test.*
FR-K-5  → tests/integration/inbound-webhooks.test.*
FR-K-6  → tests/integration/audit-log-coverage.test.* (the CI guard's positive test)
FR-K-7  → tests/integration/gdpr-consent-coverage.test.*
FR-K-8  → tests/integration/input-validation.test.* (per capability)
FR-K-9  → tests/integration/rate-limiting.test.*
FR-K-10 → tests/integration/presigned-upload-flow.test.*
FR-K-11 → tests/integration/data-layer-authorisation.test.*
```

## Dependencies

- EPIC-J — every entity referenced by a capability.
- EPIC-N — auth and permission checks.
- Shared validators (foundation package).

## Open questions

1. Confirm the protocol — REST is the default in the master spec but GraphQL is permitted.
2. Confirm the API versioning scheme (path-based `/api/v1/` vs header-based).
3. Confirm the customer-account session mechanism (cookie vs token).
