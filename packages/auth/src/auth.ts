/**
 * Better Auth configuration factory — EPIC-N auth foundation.
 *
 * `createAuth(prisma, options)` assembles the platform's `betterAuth({...})`
 * instance. It is pure configuration: nothing here connects to Postgres, Redis,
 * an OAuth provider or an SMTP server. `prismaAdapter` is lazy (it returns a
 * factory invoked later by better-auth on first use), so constructing the auth
 * object is side-effect-free and safe to do at module load.
 *
 * Wiring, per CLAUDE.md §9:
 *   - `prismaAdapter(prisma, { provider: 'postgresql' })` as the data layer.
 *   - `emailAndPassword` enabled (staff fallback + reset, FR-N-1/FR-N-5).
 *   - `socialProviders` Microsoft / Google / Apple for staff OAuth sign-in,
 *     keyed from the supplied credentials (a provider is only registered when
 *     its credentials are supplied).
 *   - `magicLink` plugin for the vendor / landlord / tenant / contractor
 *     portals.
 *   - `twoFactor` plugin (TOTP + backup codes) for staff 2FA (FR-N-2).
 *   - The session cookie carries the tenant identifier via a `tenantId`
 *     `additionalField`, and the user carries `role` + `tenantId`.
 *
 * ── Follow-on work (not in this package) ───────────────────────────────────
 * (a) The better-auth tables (`user`, `session`, `account`, `verification`,
 *     and the `two-factor` table) plus the `tenantId` / `role` columns must be
 *     generated into the Prisma schema in `packages/db` via better-auth's
 *     schema generation (`npx @better-auth/cli generate`). This package only
 *     constructs the runtime config; it does not own the schema.
 * (b) WebAuthn / passkey 2FA: `better-auth@1.6.15` core ships TOTP-based 2FA
 *     (the `two-factor` plugin used here) but NOT a passkey plugin — passkey
 *     lives in the separate `@better-auth/passkey` package, which is not a
 *     dependency of this workspace. Adding hardware-key 2FA is a follow-on that
 *     requires adding that dependency (an amendment to package.json), at which
 *     point `passkey()` joins the `plugins` array below.
 * (c) The live OAuth, magic-link and 2FA *flows* are integration-tested against
 *     a real Postgres via Testcontainers in CI; Docker is unavailable in this
 *     dev environment, so the unit tests here assert only the config shape.
 */

import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink, twoFactor } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { betterAuth } from 'better-auth';
import type { Auth as BetterAuth, BetterAuthOptions } from 'better-auth';

/** OAuth client credentials for a single social provider. */
export interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/** Inputs for {@link createAuth}. Everything that varies per deployment. */
export interface CreateAuthOptions {
  /** Signing/encryption secret (`BETTER_AUTH_SECRET`). */
  secret: string;
  /** Public base URL of the app (used for callback URLs). */
  baseURL?: string;
  /**
   * Staff OAuth providers. Only the providers present here are registered, so a
   * deployment that has not configured Apple simply omits it.
   */
  social?: {
    microsoft?: SocialProviderCredentials;
    google?: SocialProviderCredentials;
    apple?: SocialProviderCredentials;
  };
  /**
   * Delivery callback for portal magic links. The transport (per-tenant SMTP
   * via the `@estate/email` package) is injected by the caller so this package
   * stays free of an email dependency.
   */
  sendMagicLink: (data: { email: string; url: string; token: string }) => Promise<void>;
  /**
   * Delivery callback for the email-verification link (EPIC-T FR-T-1 — sent on
   * customer registration). better-auth invokes this with the verification URL
   * (carrying the one-time token); the caller delivers it through the same
   * per-tenant SMTP path as every other tenant email. Injected here so this
   * package stays free of an email dependency, exactly like {@link sendMagicLink}.
   */
  sendVerificationEmail: (data: {
    user: { email: string };
    url: string;
    token: string;
  }) => Promise<void>;
}

/**
 * Build the social-providers config object, including only providers whose
 * credentials were supplied. Returns `undefined` when none are configured so
 * the option can be omitted under `exactOptionalPropertyTypes`.
 */
function buildSocialProviders(
  social: CreateAuthOptions['social'],
): BetterAuthOptions['socialProviders'] {
  if (!social) return undefined;
  const providers: NonNullable<BetterAuthOptions['socialProviders']> = {};
  if (social.microsoft) providers.microsoft = social.microsoft;
  if (social.google) providers.google = social.google;
  if (social.apple) providers.apple = social.apple;
  return providers;
}

/**
 * Construct the platform's Better Auth instance. Pure configuration — does not
 * connect to any external system.
 *
 * @param prisma A PrismaClient (or any object — the adapter is lazy and only
 *   reads it at request time, never at construction).
 * @param options Per-deployment credentials and callbacks.
 */
export function createAuth(prisma: object, options: CreateAuthOptions): BetterAuth {
  const config = {
    secret: options.secret,
    ...(options.baseURL !== undefined ? { baseURL: options.baseURL } : {}),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    // Our auth-table primary keys are `@db.Uuid @default(uuid())` (packages/db),
    // so the database mints ids. Tell better-auth NOT to generate its own string
    // ids, or its INSERTs would supply an id that fights the schema default.
    advanced: {
      database: {
        generateId: false,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    // EPIC-T FR-T-1 — a customer who registers receives an email-verification
    // message. better-auth mints the verification token + URL and hands them to
    // our injected callback; `sendOnSignUp: true` fires it automatically after
    // sign-up, so the registration action does not have to trigger it by hand.
    // The FR-T-2 save gates read the resulting `emailVerified` flag.
    emailVerification: {
      sendVerificationEmail: (data) => options.sendVerificationEmail(data),
      sendOnSignUp: true,
    },
    socialProviders: buildSocialProviders(options.social),
    user: {
      additionalFields: {
        // The agency (platform tenant) this user belongs to. Scoped at the data
        // layer by RLS; carried here so it can be read from the session.
        tenantId: { type: 'string', required: false, input: false },
        // The staff RBAC role (one of STAFF_ROLES). The role→permission mapping
        // lives in `roles.ts`.
        role: { type: 'string', required: false, input: false },
        // Discriminates a staff member from a registered customer (EPIC-T;
        // PRODUCT.md §3). `input: true` so the customer-registration seam can set
        // it to `customer` through signUpEmail; staff rows keep the schema
        // default (`staff`). The customer-session seam admits only `customer`.
        type: { type: 'string', required: false, input: true },
        // The customer's optional marketing opt-in (EPIC-T FR-T-1). `input: true`
        // so registration can persist the captured choice through signUpEmail;
        // defaults to false at the schema level otherwise.
        marketingOptIn: { type: 'boolean', required: false, input: true },
      },
    },
    session: {
      additionalFields: {
        // The tenant identifier carried on every session per CLAUDE.md §9. Read
        // from the session cookie in every Server Action / route handler /
        // Payload access function to reapply the per-request RLS GUC.
        tenantId: { type: 'string', required: false, input: false },
      },
    },
    // next-cookies MUST be last: it bridges Set-Cookie into next/headers so that
    // session cookies set during a Server-Action / RSC `auth.api` call (e.g. a
    // session refresh on read) actually land. better-auth warns if it is not last.
    plugins: [magicLink({ sendMagicLink: options.sendMagicLink }), twoFactor(), nextCookies()],
  } satisfies BetterAuthOptions;

  // The full inferred return type of `betterAuth(config)` references zod's
  // internal endpoint-schema types, which TS cannot name portably across the
  // workspace when emitting declarations (TS2742). We widen to the documented
  // public `Auth` shape — the instance still exposes `handler`, `api`,
  // `options`, `$context`, etc. — and the plugin/field-augmented surface is
  // read through `auth.options` (typed as BetterAuthOptions), which is what
  // callers and the config-shape test inspect. The double assertion is required
  // because the precise (plugin-augmented) and generic `Auth` instantiations are
  // structurally divergent at the `api` member.
  return betterAuth(config) as unknown as BetterAuth;
}

/** The constructed auth instance type. */
export type Auth = BetterAuth;
