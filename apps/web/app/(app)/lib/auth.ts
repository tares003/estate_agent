import { notify, requireAuthTenant, withTenant, type NotificationWriter } from '@estate/db';
import { createAuth, type Auth, type SocialProviderCredentials } from '@estate/auth';

import { getAuthDb } from './auth-db.js';
import { getDb } from './db.js';
import {
  magicLinkNotification,
  passwordResetNotification,
  verificationEmailNotification,
} from './magic-link.js';

// B78b glue — composes the platform's Better Auth instance (EPIC-N, CLAUDE.md §9).
//
// `getAuth()` is env-gated and fail-soft: with no BETTER_AUTH_SECRET configured it
// returns null and the running app is byte-for-byte unchanged (the route mount
// 404s, the staff-session reader falls back to its dev seam). When configured it
// builds the auth instance against the BYPASSRLS, tenant-scoped auth client
// (auth-db.ts) with social providers from env and magic-link delivery wired to the
// per-tenant email outbox.
//
// Connection/config glue — reads env, constructs the better-auth instance, and
// (sendAuthMagicLink) opens a tenant transaction. Excluded from unit coverage; the
// pure pieces it calls (createAuth shape, magicLinkNotification, the tenant-scope
// injector) are unit-tested in their own packages, and the live flows are covered
// by the Testcontainers integration tests (B78e).

/** better-auth's magicLink callback — queue the link as a per-tenant email. */
async function sendAuthMagicLink(data: { email: string; url: string }): Promise<void> {
  const tenantId = requireAuthTenant();
  await withTenant(getDb(), tenantId, (tx) =>
    notify(
      tx as unknown as NotificationWriter,
      magicLinkNotification(data.email, data.url, tenantId),
    ),
  );
}

/**
 * better-auth's emailVerification callback (EPIC-T FR-T-1) — queue the
 * verification link as a per-tenant email, on the same path as the magic link.
 */
async function sendAuthVerificationEmail(data: {
  user: { email: string };
  url: string;
}): Promise<void> {
  const tenantId = requireAuthTenant();
  await withTenant(getDb(), tenantId, (tx) =>
    notify(
      tx as unknown as NotificationWriter,
      verificationEmailNotification(data.user.email, data.url, tenantId),
    ),
  );
}

/**
 * better-auth's sendResetPassword callback (EPIC-N FR-N-5) — queue the
 * password-reset link as a per-tenant email, on the same path as the magic link.
 */
async function sendAuthResetPasswordEmail(data: {
  user: { email: string };
  url: string;
}): Promise<void> {
  const tenantId = requireAuthTenant();
  await withTenant(getDb(), tenantId, (tx) =>
    notify(
      tx as unknown as NotificationWriter,
      passwordResetNotification(data.user.email, data.url, tenantId),
    ),
  );
}

/** Read an OAuth provider's credentials from env, or undefined when unconfigured. */
function providerFromEnv(idVar: string, secretVar: string): SocialProviderCredentials | undefined {
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

/** Staff OAuth providers (Microsoft/Google/Apple) — only those with creds set. */
function socialFromEnv(): NonNullable<Parameters<typeof createAuth>[1]['social']> {
  const microsoft = providerFromEnv('MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET');
  const google = providerFromEnv('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
  const apple = providerFromEnv('APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET');
  return {
    ...(microsoft ? { microsoft } : {}),
    ...(google ? { google } : {}),
    ...(apple ? { apple } : {}),
  };
}

let auth: Auth | null | undefined;

/**
 * The platform Better Auth instance, or null when unconfigured (no
 * BETTER_AUTH_SECRET). Memoised after the first call.
 */
export function getAuth(): Auth | null {
  if (auth !== undefined) return auth;
  const secret = process.env['BETTER_AUTH_SECRET'];
  if (!secret) {
    auth = null;
    return auth;
  }
  auth = createAuth(getAuthDb(), {
    secret,
    ...(process.env['BETTER_AUTH_URL'] ? { baseURL: process.env['BETTER_AUTH_URL'] } : {}),
    sendMagicLink: sendAuthMagicLink,
    sendVerificationEmail: sendAuthVerificationEmail,
    sendResetPasswordEmail: sendAuthResetPasswordEmail,
    social: socialFromEnv(),
  });
  return auth;
}
