# @estate/email

The platform's outbound email layer. React Email templates, `nodemailer` SMTP send abstraction, and the per-tenant SMTP credential resolver.

## Two sending paths

1. **Tenant-side SMTP** — when the platform sends on behalf of a tenant (a tenant's customer receives an email), the resolver looks up the tenant's configured SMTP from the `tenant_smtp_credentials` table, decrypts the password / OAuth refresh token using AES-256-GCM (key from env), and configures a per-send `nodemailer` transport.
2. **Operator-side SMTP** — when the platform sends to a tenant (welcome, billing, sub-processor change notification), it uses the operator's install-time-configured SMTP (env vars).

## OAuth flow

For tenants on Office 365 or Google Workspace (basic-auth deprecated), the tenant connects their account via OAuth in the admin (EPIC-H FR-H-10a). The refresh token is stored encrypted; an access-token cache in Redis avoids re-refreshing on every send.

## Templates

React Email components in `packages/email/templates/*.tsx`. Compiled to HTML at send time via `@react-email/render`. Templates inherit a base layout that respects the tenant's brand tokens.

## Discipline

Every template has a Playwright visual-regression test at the seven breakpoints (G11) AND a desktop+mobile email-client render test (using the `react-email preview` server). Credentials never enter logs (G-level lint rule). Coverage gate: **100% line + branch** on the credential-decrypt and per-tenant resolver paths.

Status: **skeleton** — built alongside the tenant SMTP screen (EPIC-H FR-H-10a).
