# EPIC-T — Customer accounts

**Master spec reference:** Section C.17 (account routes), Section B.20–B.24 (registration / login / save / saved-search / customer dashboard features).
**Pack:** Core.
**Status:** NOT_STARTED.
**Paired design brief:** [design-briefs/v1/EPIC-T-customer-accounts.md](../../design-briefs/v1/EPIC-T-customer-accounts.md).
**Phase ownership:** Phase 6 of the build roadmap.

## Purpose

Implement the customer-account shell — a distinct surface from the public marketing site and the admin dashboard, with its own authentication, its own routes, and its own user role (`type=customer` in the `users` entity). Customer-account users save properties, save searches with email alerts, view their viewing history, manage their profile and consent preferences, and (optionally) submit and track repair tickets if they are an existing tenant.

## Surfaces

- `/register` — create a customer account.
- `/sign-in` — sign in with email + password.
- `/forgot-password`, `/reset-password` — password recovery.
- `/verify-email` — email verification token consumer.
- `/account` — dashboard landing.
- `/account/saved` — saved properties.
- `/account/searches` — saved searches with alert frequency.
- `/account/viewings` — viewing requests history.
- `/account/profile` — name, email, phone, communication preferences.
- `/account/settings` — alert settings, marketing-opt-in, change password, enable 2FA, delete account.
- `/account/notifications` — in-platform notification inbox (optional V1).

## Functional requirements

- **FR-T-1.** A visitor shall be able to register for a customer account with name, email, password, GDPR consent and optional marketing opt-in. Successful registration creates a `users` record with `type=customer` and sends an email-verification message.
- **FR-T-2.** A user shall not be able to save a property, save a search, or book a viewing under their account until they have verified their email.
- **FR-T-3.** A registered customer shall be able to sign in with email + password and be returned to the route they were trying to reach prior to authentication.
- **FR-T-4.** A registered customer shall be able to enable 2FA on their account voluntarily. 2FA is not mandatory for customer accounts (it is mandatory for staff per `PRODUCT.md` §5).
- **FR-T-5.** Saving a property from a card or detail page shall add a `saved_properties` row for the current user. Saving while signed out shall prompt sign-in or register and shall complete the save after authentication without losing the action.
- **FR-T-6.** A saved-property heart UI shall persist its state across navigation and across sessions.
- **FR-T-7.** A customer shall be able to save the currently active filter combination on `/properties` as a named saved search with an alert frequency (off / instant / daily / weekly).
- **FR-T-8.** A customer shall be able to view, rename, update the alert frequency of, or delete any of their saved searches.
- **FR-T-9.** A customer shall be able to view a chronological list of their viewing requests with status (pending, confirmed, rescheduled, cancelled, attended, no-show) and the property each refers to.
- **FR-T-10.** A customer shall be able to cancel a pending or confirmed viewing request, with the cancellation propagating an email to the assigned agent.
- **FR-T-11.** A customer shall be able to update their name, phone, communication preferences and marketing-opt-in flag.
- **FR-T-12.** A customer shall be able to request account deletion. Deletion shall anonymise the `users` record and the linked `saved_properties` and `saved_searches` within 24 hours, while preserving anonymised audit-log entries for compliance.
- **FR-T-13.** A customer shall be able to invoke the Subject Access Request export tool from their own account settings, producing a zipped JSON dump of their data within the defined window.
- **FR-T-14.** Sign-in attempts shall be rate-limited and accounts shall lock after the threshold defined in `EPIC-N` FR-N-3.
- **FR-T-15.** Customer sessions shall expire after the inactivity period defined in settings (default: 30 days for customers, compared with 8 hours for staff).

## User stories

- As a property hunter, I want to register quickly with email and a password so I can start saving properties.
- As a busy buyer, I want a daily digest of new properties matching my saved search so I don't have to keep checking.
- As a returning visitor, I want to save a property without losing the property in question if I'm asked to sign in mid-action.
- As a privacy-conscious customer, I want to download everything you hold about me and to delete my account from inside the platform without contacting support.
- As a tenant whose viewing is being rescheduled, I want to see the new time in my account without searching my email inbox.

## Acceptance criteria

- Registration → email verify → first save → return to saved list works end-to-end in under two minutes.
- A saved property persists across sign-out and sign-in.
- A `daily`-frequency saved-search alert is emailed only when there are new matches since the previous alert.
- Account deletion fully anonymises personal-data fields within 24 hours.
- The SAR export contains every record that references the customer's email address.
- Customer sign-in fails closed when rate-limited or locked.
- All account-area routes are inaccessible to a signed-out user and redirect to `/sign-in` with `?next=<original-url>` preserved.

## Test mapping

```
FR-T-1  → tests/integration/customer-registration.test.*, tests/e2e/register-flow.spec.*
FR-T-2  → tests/integration/email-verification-gating.test.*
FR-T-3  → tests/e2e/sign-in-redirect.spec.*
FR-T-4  → tests/integration/customer-2fa-opt-in.test.*
FR-T-5  → tests/integration/save-property-action.test.*, tests/e2e/save-after-signin.spec.*
FR-T-6  → tests/component/save-property-heart.test.* (state persistence)
FR-T-7  → tests/integration/saved-search-create.test.*
FR-T-8  → tests/integration/saved-search-crud.test.*
FR-T-9  → tests/integration/viewings-history.test.*
FR-T-10 → tests/integration/customer-cancel-viewing.test.*
FR-T-11 → tests/integration/customer-profile-update.test.*
FR-T-12 → tests/integration/account-deletion.test.*, tests/regression/EPIC-T/EPIC-T-account-deletion.regression.test.*
FR-T-13 → tests/integration/self-service-sar.test.*
FR-T-14 → tests/integration/customer-sign-in-rate-limit.test.*
FR-T-15 → tests/integration/customer-session-expiry.test.*
A11y    → tests/a11y/account-routes.spec.*
Visual  → tests/visual/account-screens.spec.*
```

## Dependencies

- EPIC-J — `users`, `sessions`, `saved_properties`, `saved_searches`.
- EPIC-K — every customer-facing capability defined in master spec Section K.2.
- EPIC-N — auth foundations, RBAC, audit log, retention purge, SAR export.
- EPIC-U — the saved-search alert digest worker.

## Open questions

1. Confirm the V1 scope for the in-platform notification inbox (recommended: deferred unless email noise is a customer complaint).
2. Confirm the policy on saving an under-offer or sold property to favourites (allow vs disallow).
3. Confirm whether social sign-in (Google / Apple) is in V1 (recommended: deferred to V2).
4. Confirm the policy on a customer who registers with the same email as a deleted account (recommended: allow re-registration after grace period).
