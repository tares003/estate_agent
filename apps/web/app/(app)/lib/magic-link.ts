import type { NotifyInput } from '@estate/db';

// B78b — the Better Auth magic-link delivery bridge (EPIC-N, FR-N-*). better-auth's
// magicLink plugin calls the sendMagicLink callback (auth.ts) with the one-time
// verification url; we deliver it the same way every other tenant email is sent —
// by queuing a notification_logs row that the EPIC-U email worker renders (with the
// `auth.magic_link` template) and sends through the tenant's own SMTP. This module
// holds the pure mapping; the orchestration (resolve tenant → withTenant → notify)
// is glue in auth.ts.

/**
 * The queued-email {@link NotifyInput} for a Better Auth magic link. `event` and
 * `channel` are the contract with apps/workers' template registry; `payload.url`
 * is the verification link the template interpolates.
 */
export function magicLinkNotification(email: string, url: string, tenantId: string): NotifyInput {
  return {
    tenantId,
    event: 'auth.magic_link',
    channel: 'email',
    recipient: email,
    payload: { url },
  };
}

/**
 * The queued-email {@link NotifyInput} for the EPIC-T FR-T-1 email-verification
 * link. Same delivery path as the magic link (a `notification_logs` row the
 * EPIC-U email worker renders + sends through the tenant's own SMTP); the
 * distinct `event` lets the worker pick the `auth.verify_email` template.
 */
export function verificationEmailNotification(
  email: string,
  url: string,
  tenantId: string,
): NotifyInput {
  return {
    tenantId,
    event: 'auth.verify_email',
    channel: 'email',
    recipient: email,
    payload: { url },
  };
}
