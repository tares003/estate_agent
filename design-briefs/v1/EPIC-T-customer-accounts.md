# EPIC-T — Customer accounts (design)

**Dev brief:** [dev-briefs/v1/EPIC-T-customer-accounts.md](../../dev-briefs/v1/EPIC-T-customer-accounts.md).
**Master spec reference:** Section C.17.
**Status:** NOT_STARTED.

## Surfaces affected

- `/register` (full-page form).
- `/sign-in` (full-page form with "forgot password" and "create account" links).
- `/forgot-password`, `/reset-password` (full-page forms).
- `/verify-email` (status confirmation page).
- `/account` (dashboard with summary cards).
- `/account/saved` (grid of property cards).
- `/account/searches` (list of saved searches with alert frequency dropdown).
- `/account/viewings` (chronological list with status badges).
- `/account/profile`, `/account/settings`, `/account/notifications`.

## Layout patterns

### Authentication forms

- Centred single-column layout, max width `--size-container-sm`.
- Logo at top, form, helper link, footer.
- Visible password-strength indicator on register and reset.
- "Stay signed in" checkbox where applicable.
- GDPR consent row at the bottom of register, above the submit button.
- Anti-spam challenge between consent and submit.

### Account shell

- Left rail (or top tabs on mobile): Dashboard, Saved properties, Saved searches, Viewings, Profile, Settings, Sign out.
- Main pane: section-specific content.
- Topbar of the public site remains visible — this is a "logged-in mode" of the public site, not a separate app.

### Dashboard landing

- Three summary cards at top: saved properties count + "View all", saved searches count + alert frequency summary, viewings count + next upcoming.
- Below: a "Latest matches" feed showing the top three new matches across all saved searches.
- Below: a recent activity feed.

### Saved properties

- Reuses the universal Property Card with a small "Remove from saved" affordance on hover or via the heart toggle.
- Sort by date saved (default), price ascending / descending.
- Empty state: "You haven't saved any properties yet" with a primary CTA to `/properties`.

### Saved searches

- Each saved search is a row showing: name, criteria summary as filter chips, alert frequency dropdown (off / instant / daily / weekly), "Run search now" link, delete affordance.
- Confirmation modal on delete.

### Viewings

- Chronological list, most recent first.
- Each row: property card preview, date and time, status badge, agent assigned, primary action (Reschedule, Cancel, Leave feedback).
- Past viewings collapse into an "Earlier viewings" accordion.

### Account deletion

- Settings page surfaces a "Delete account" link in a clearly de-emphasised treatment (not next to other primary actions).
- Two-step confirmation per `EPIC-N` erasure pattern: 1) type your email; 2) type DELETE.
- Success screen explains what will be anonymised and what is retained.

## Component inventory

`RegisterForm`, `SignInForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `EmailVerifyScreen`, `AccountSidebar`, `AccountDashboardCards`, `SavedPropertyCard` (reuses `PropertyCard`), `SavedSearchRow`, `ViewingRow`, `AccountSettingsForm`, `DeleteAccountFlow`. All built on the EPIC-L primitives.

## State variations

- **Empty saved properties:** "You haven't saved any properties yet" + CTA.
- **Empty saved searches:** "Save a search to get email alerts when new properties match" + CTA to `/properties`.
- **No upcoming viewings:** "You don't have any viewings scheduled" + CTA to `/properties`.
- **Email not verified:** persistent banner across all account routes prompting the user to check their email or resend verification.
- **Account locked from sign-in attempts:** sign-in form shows a clear "Account temporarily locked. Try again in 30 minutes" message with a "Forgot password" CTA.
- **Reset-password token expired:** clear "This reset link has expired" page with "Request a new link" CTA.

## Accessibility specifics

- Email and password fields use `autocomplete` attributes (`email`, `current-password`, `new-password`).
- Password-strength indicator is announced via `aria-live="polite"` only when state changes meaningfully (not on every keystroke).
- 2FA enrolment within the customer account follows the EPIC-N flow.
- "Stay signed in" checkbox has a clear explanation of its effect on session lifetime.

## Responsive behaviour

- Account sidebar collapses to a horizontal pill nav above `--breakpoint-md`.
- Saved-properties grid: 4 columns desktop, 2 columns tablet, 1 column mobile.
- Account dashboard summary cards: 3 across desktop, stacked mobile.

## Motion

- Saved-property heart toggle: instant state change with a small `scale(1.1)` pulse over `--motion-duration-fast` (disabled under reduced-motion).
- Section transitions between sidebar tabs: instant (no fade) to feel responsive.
- Toast notifications on actions (saved, removed, search saved) per standard toast rules.

## Token references

- Heart-icon filled: `--colour-brand-accent`.
- Heart-icon unfilled: `--colour-text-muted`.
- Alert-frequency dropdown: `--colour-surface-raised` background.
- Account-locked banner: `--colour-warning` background, `--colour-text-primary` text.

## Open design questions

1. Confirm the heart-toggle affordance position on the property card (corner of image vs adjacent to title).
2. Confirm whether the account dashboard "latest matches" feed shows three or six items.
3. Confirm the visual treatment of the "you have unverified email" banner (sticky top of viewport vs in-line above content).
4. Confirm whether the account sidebar shows an avatar or just initials.
