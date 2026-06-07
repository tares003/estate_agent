# @estate/email-templates

Shared transactional email-template source for both stacks. Rendered server-side; delivered via **per-tenant SMTP** (tenant-facing) or **operator SMTP** (operator-facing) per `AGENTS.md` §9.

## Scope

Templates for the §H.13 notification matrix: enquiry confirmations, viewing confirmations (with calendar attachment), saved-search alerts, repair-ticket status changes, password reset, email verification, operator↔tenant correspondence (welcome, billing, sub-processor change), etc.

## Build contract

- Tokenised styling only (guard G7) — emails inline tokens from `@estate/tokens` at build time; no raw hex.
- Each template is keyed via `@estate/i18n` (no inline copy).
- Canvas reference: `design/canvas/screens/emails/transactional-emails.html`.
- Trust markers (`PRODUCT.md` §8) — rent frequency, price qualifiers, "indicative only" — render where the template shows the relevant figure (guard G8).

Status: **skeleton** — built in the CRM/email phase (B7) and consumed earlier by auth (B2).
