# EPIC-N — Security and GDPR (design)

**Dev brief:** [dev-briefs/v1/EPIC-N-security-gdpr.md](../../dev-briefs/v1/EPIC-N-security-gdpr.md).
**Master spec reference:** Section N.
**Pack:** Core.
**Status:** NOT_STARTED.

## Surfaces affected

- Cookie consent banner.
- GDPR consent row pattern (re-used in every public form).
- Two-factor enrolment flow.
- Login / register / password-reset / email-verify screens.
- Subject Access Request export wizard (admin).
- Erasure tool with two-step confirmation (admin).
- Audit log viewer.

## Cookie banner

- Bottom-of-viewport banner that does not block content but cannot be dismissed without a choice.
- Three primary actions: Accept all / Reject non-essential / Customise.
- Customise panel: granular per-category toggles (Necessary forced on, Analytics, Marketing, Preferences).
- Plain language: "We use cookies to make this site work and to understand how it's used. Choose your preferences below." No legalese in the banner itself.
- Link to the full Cookie Policy.

## GDPR consent row

- Single checkbox + label inside the form, immediately above the submit button.
- Required marker on the label.
- Label includes a link to the Privacy Policy that opens in a new tab.
- Marketing opt-in (if present) is a second, distinct checkbox below — always unticked by default.

## Two-factor enrolment

- Triggered on first sign-in for any role that requires 2FA per `PRODUCT.md` section 5.
- Steps: 1) introduce 2FA. 2) display QR code + manual entry key. 3) verify a 6-digit code. 4) backup codes shown once with explicit "I have saved these" affirmation.
- A user who skips 2FA enrolment cannot reach the admin.

## SAR export wizard

- Step 1: enter the data subject's email.
- Step 2: confirm the search scope (entities to include).
- Step 3: run; show progress while gathering.
- Step 4: deliver via signed URL or encrypted email.
- Audit-log entry on completion.

## Erasure tool

- Two-step confirmation: "Type the email to confirm" → "Type DELETE to confirm".
- Preview screen showing every row that will be affected.
- After completion, success page summarises what was anonymised and what was retained (e.g. audit-log entries kept but anonymised).

## Audit log viewer

- Reverse-chronological table with sticky filters at the top.
- Row click expands to show full diff with syntax-highlighted JSON.
- Export filtered set as CSV / JSON.

## Component inventory

`CookieBanner`, `GDPRConsentRow`, `TwoFactorEnrolmentFlow`, `LoginForm`, `RegisterForm`, `PasswordResetForm`, `EmailVerifyScreen`, `SARExportWizard`, `ErasureTool`, `AuditLogViewer`.

## State variations

- **Cookie banner:** dismissed state (banner not shown) for users with persisted consent.
- **2FA enrolment:** "Couldn't scan?" link reveals manual entry; "Code incorrect" error inline.
- **Erasure tool:** "Records found: X" surface before final confirmation; "No records found" if the email isn't recognised.

## Accessibility specifics

- Cookie banner buttons all keyboard-reachable in tab order.
- GDPR consent checkbox `aria-required="true"`.
- 2FA QR code accompanied by readable text equivalent.
- Erasure confirmation inputs use real text inputs with required pattern matching.

## Responsive

- Cookie banner full-width on mobile, padded inset on desktop.
- 2FA enrolment flow renders as a single column on mobile.

## Motion

- Cookie banner slide-in: `--motion-duration-base` `--motion-ease-emphasis`.
- 2FA enrolment step transitions: `--motion-duration-base`.

## Token references

- Cookie banner uses `--colour-surface-base` background with `--shadow-md`.
- Required-marker uses `--colour-text-muted`.

## Open design questions

1. Confirm the cookie-banner placement (bottom centre, bottom right corner, top of viewport).
2. Confirm the visual treatment of the SAR export wizard (modal vs full-screen flow).
3. Confirm the 2FA mechanism (TOTP only in V1, or also WebAuthn?).

## Pack-state behaviour

Per `design-requirements.md` §2a — security and access patterns are pack-aware:

- **Permissions catalogue**: the role editor exposes a new `pack.manage` permission, granted by default only to the tenant's super-admin role.
- **Audit-log viewer**: pack-related events (`pack.enabled`, `pack.disabled`, `pack.trial.started`, `pack.trial.ended`, `pack.cancellation.requested`, `pack.cancellation.processed`) render with a dedicated event-type pill and a per-event detail view showing the actor, the pack, and the billing implication.
- **GDPR Subject Access Request export**: per-tenant exports include the tenant's pack history alongside other lifecycle data.
- **GDPR erasure**: pack-dependent personal data (e.g. vendor-portal saved offers under `sales_plus`) is included in the erasure scan regardless of current pack state. Disabling a pack does not exclude its data from erasure.
