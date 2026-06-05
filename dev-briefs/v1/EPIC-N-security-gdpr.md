# EPIC-N — Security and GDPR

**Master spec reference:** Section N (N.1–N.9).
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-N-security-gdpr.md](../../design-briefs/v1/EPIC-N-security-gdpr.md).

## Purpose

Implement the platform-wide security baseline: authentication, authorisation, input validation, file-upload safety, rate limiting, anti-spam, GDPR consent capture, audit logging, secrets management, operational security headers, retention purging and Subject Access Request tooling.

## Functional requirements

- **FR-N-1.** Passwords shall be hashed with a modern memory-hard algorithm (Argon2id or equivalent OWASP-recommended configuration). Plain-text or reversible storage is forbidden.
- **FR-N-2.** Two-factor authentication shall be supported for all users and shall be mandatory for super admin and branch manager roles per `PRODUCT.md` section 5.
- **FR-N-3.** Login attempts shall be rate-limited (10 per 15 min per IP and per account). Five consecutive failures shall lock the account for 30 min.
- **FR-N-4.** Session cookies shall be `HttpOnly`, `Secure`, `SameSite=Lax` and named with the `__Host-` prefix.
- **FR-N-5.** Password-reset tokens shall be single-use, expire after 60 min and be opaque random of at least 32 bytes encoded for URL safety.
- **FR-N-6.** Every administrative capability shall require the relevant permission, scoped by branch where the permission is branch-scoped.
- **FR-N-7.** Every input shall be validated against the shared validator schema; unknown fields shall be rejected.
- **FR-N-8.** File uploads shall use pre-signed direct upload URLs with allow-listed MIME types and size caps per master spec Section N.4.
- **FR-N-9.** Uploaded images shall be re-processed to strip EXIF (including location metadata) and re-encoded.
- **FR-N-10.** Uploaded files shall be virus-scanned before being marked public.
- **FR-N-11.** Every public POST shall enforce a challenge-response or behavioural anti-spam check verified server-side.
- **FR-N-12.** Every form that captures personal data shall require a GDPR consent affirmation recorded via the shared consent helper.
- **FR-N-13.** Cookie consent shall be granular (necessary, analytics, marketing, preferences) and shall gate the loading of non-essential scripts. Every consent decision shall be logged.
- **FR-N-14.** Every state-changing administrative capability shall write an audit-log entry with actor, action, entity, entity identifier, structured diff, IP and user-agent.
- **FR-N-15.** Standard security headers shall be emitted on every response: HSTS, X-Content-Type-Options, X-Frame-Options or CSP frame-ancestors, Referrer-Policy, Permissions-Policy.
- **FR-N-16.** The retention purge job shall anonymise records past their configured retention window per master spec Section N.6.
- **FR-N-17.** The Subject Access Request export tool shall produce a zipped JSON dump of every record across every entity that references a given email address, plus the linked media files.
- **FR-N-18.** The Erasure tool shall anonymise every personal-data field across every entity for a given email address, with a two-step confirmation, and log the action.

## Acceptance criteria

- A successful login lands on the dashboard with 2FA enrolment required if the user's role mandates it.
- Brute-force attempts are blocked at the configured threshold.
- A property image uploaded with embedded GPS coordinates is re-processed to strip those coordinates.
- An attempted public-form submission without the anti-spam token is rejected.
- An attempted form submission without GDPR consent is rejected with a clear error.
- The SAR export contains every record that references the searched email address.
- The Erasure tool leaves audit-log entries intact (anonymised) but removes the personal-data values themselves.

## Test mapping

```
FR-N-1  → tests/unit/password-hash.test.* (property-based)
FR-N-2  → tests/integration/2fa-enrolment.test.*, tests/integration/2fa-enforcement.test.*
FR-N-3  → tests/integration/login-rate-limit.test.*, tests/integration/account-lockout.test.*
FR-N-4  → tests/integration/session-cookie-flags.test.*
FR-N-5  → tests/integration/password-reset-token.test.*
FR-N-6  → tests/integration/rbac-enforcement.test.* (per role x capability)
FR-N-7  → tests/integration/input-validation.test.*
FR-N-8  → tests/integration/upload-mime-allowlist.test.*
FR-N-9  → tests/integration/exif-strip.test.*
FR-N-10 → tests/integration/virus-scan.test.*
FR-N-11 → tests/integration/anti-spam-verification.test.*
FR-N-12 → tests/integration/gdpr-consent-required.test.*
FR-N-13 → tests/e2e/cookie-banner.spec.*, tests/integration/consent-log.test.*
FR-N-14 → tests/integration/audit-log-coverage.test.*
FR-N-15 → tests/integration/security-headers.test.*
FR-N-16 → tests/integration/retention-purge.test.*
FR-N-17 → tests/integration/sar-export.test.*
FR-N-18 → tests/integration/erasure-tool.test.*
```

## Dependencies

- EPIC-J — the underlying entities, including consent_logs, audit_logs.
- EPIC-K — every state-changing capability triggers the audit helper.
- Shared validators package.

## Open questions

1. Confirm the 2FA mechanism (time-based one-time password is the default; consider WebAuthn for V2).
2. Confirm the policy on session timeouts for staff (default: 8 hours idle, 12 hours absolute).
3. Confirm the policy on automatic data export delivery (signed URL vs encrypted email).
4. Confirm the policy on background-job re-tries for transient virus-scan failures.
