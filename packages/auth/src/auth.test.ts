import { describe, expect, it } from 'vitest';

import { createAuth, type CreateAuthOptions } from './auth.js';

// A structural stand-in for a PrismaClient. better-auth's `prismaAdapter`
// types its first argument as `PrismaClient {}` (an empty interface), so any
// object satisfies it; the adapter is lazy and never touches the DB at
// construction time. We assert the *configuration*, not a live connection.
const fakePrisma = {} as never;

const dummyCreds: CreateAuthOptions = {
  secret: 'test-secret-not-used-to-connect',
  baseURL: 'https://acme.estateplatform.test',
  social: {
    microsoft: { clientId: 'ms-id', clientSecret: 'ms-secret' },
    google: { clientId: 'g-id', clientSecret: 'g-secret' },
    apple: { clientId: 'apple-id', clientSecret: 'apple-secret' },
  },
  sendMagicLink: async () => {
    /* no-op in the shape test */
  },
  sendVerificationEmail: async () => {
    /* no-op in the shape test */
  },
  sendResetPasswordEmail: async () => {
    /* no-op in the shape test */
  },
};

describe('createAuth — configuration shape (no DB connection)', () => {
  const auth = createAuth(fakePrisma, dummyCreds);

  it('returns a better-auth instance exposing the standard surface', () => {
    expect(typeof auth.handler).toBe('function');
    expect(typeof auth.api).toBe('object');
    expect(auth.options).toBeTypeOf('object');
  });

  it('enables email-and-password authentication', () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
  });

  it('wires the email-verification magic link, sent automatically on sign up (EPIC-T FR-T-1)', () => {
    // FR-T-1: registration sends an email-verification message; better-auth's
    // verification link is delivered via the injected sendVerificationEmail
    // callback and triggered automatically after sign up (sendOnSignUp).
    expect(typeof auth.options.emailVerification?.sendVerificationEmail).toBe('function');
    expect(auth.options.emailVerification?.sendOnSignUp).toBe(true);
  });

  it('routes the verification email through the supplied sendVerificationEmail callback', async () => {
    const sent: Array<{ email: string; url: string }> = [];
    const wired = createAuth(fakePrisma, {
      secret: 'x',
      sendMagicLink: async () => {},
      sendVerificationEmail: async (data) => {
        sent.push({ email: data.user.email, url: data.url });
      },
      sendResetPasswordEmail: async () => {},
    });
    const send = wired.options.emailVerification?.sendVerificationEmail;
    expect(send).toBeTypeOf('function');
    await send?.(
      { user: { email: 'penny@example.invalid' }, url: 'https://acme.test/verify?token=abc', token: 'abc' } as never,
      undefined as never,
    );
    expect(sent).toEqual([{ email: 'penny@example.invalid', url: 'https://acme.test/verify?token=abc' }]);
  });

  it('wires the password-reset email callback and a 60-minute token expiry (FR-N-5)', () => {
    // FR-N-5: reset tokens expire after 60 min. better-auth mints the opaque,
    // single-use token (a `verification` row deleted on use) and hands the reset
    // URL to the injected sendResetPassword callback; the expiry is configured in
    // seconds.
    expect(typeof auth.options.emailAndPassword?.sendResetPassword).toBe('function');
    expect(auth.options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(60 * 60);
  });

  it('routes the reset-password email through the supplied sendResetPasswordEmail callback', async () => {
    const sent: Array<{ email: string; url: string }> = [];
    const wired = createAuth(fakePrisma, {
      secret: 'x',
      sendMagicLink: async () => {},
      sendVerificationEmail: async () => {},
      sendResetPasswordEmail: async (data) => {
        sent.push({ email: data.user.email, url: data.url });
      },
    });
    const send = wired.options.emailAndPassword?.sendResetPassword;
    expect(send).toBeTypeOf('function');
    await send?.(
      { user: { email: 'penny@example.invalid' }, url: 'https://acme.test/reset-password?token=abc', token: 'abc' } as never,
      undefined as never,
    );
    expect(sent).toEqual([{ email: 'penny@example.invalid', url: 'https://acme.test/reset-password?token=abc' }]);
  });

  it('configures the Microsoft, Google and Apple social providers', () => {
    const social = auth.options.socialProviders ?? {};
    expect(social.microsoft).toBeDefined();
    expect(social.google).toBeDefined();
    expect(social.apple).toBeDefined();
  });

  it('keys each social provider from the supplied credentials', () => {
    const social = auth.options.socialProviders ?? {};
    // better-auth types each provider value as `ProviderOptions | (() =>
    // Awaitable<ProviderOptions>)`. We supply the static-object form, so narrow
    // to a record before reading the credential fields.
    const creds = (value: unknown): Record<string, unknown> => {
      expect(typeof value).toBe('object');
      return value as Record<string, unknown>;
    };
    expect(creds(social.microsoft).clientId).toBe('ms-id');
    expect(creds(social.microsoft).clientSecret).toBe('ms-secret');
    expect(creds(social.google).clientId).toBe('g-id');
    expect(creds(social.apple).clientId).toBe('apple-id');
  });

  it('registers the magic-link and two-factor (WebAuthn-track) plugins', () => {
    const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(pluginIds).toContain('magic-link');
    expect(pluginIds).toContain('two-factor');
  });

  it('registers next-cookies LAST so RSC/Server-Action session writes propagate', () => {
    const pluginIds = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(pluginIds).toContain('next-cookies');
    // better-auth requires the cookie plugin to be last (it warns otherwise).
    expect(pluginIds[pluginIds.length - 1]).toBe('next-cookies');
  });

  it('carries the tenant identifier on the session via an additional field', () => {
    const sessionFields = auth.options.session?.additionalFields ?? {};
    expect(sessionFields.tenantId).toBeDefined();
    expect(sessionFields.tenantId?.type).toBe('string');
  });

  it('also carries the staff role on the user via an additional field', () => {
    const userFields = auth.options.user?.additionalFields ?? {};
    expect(userFields.role).toBeDefined();
    expect(userFields.tenantId).toBeDefined();
  });

  it('passes the supplied baseURL and secret straight through to the config', () => {
    expect(auth.options.baseURL).toBe('https://acme.estateplatform.test');
    expect(auth.options.secret).toBe('test-secret-not-used-to-connect');
  });

  it('configures the prisma adapter as the database layer', () => {
    expect(auth.options.database).toBeDefined();
  });

  it('lets the database mint ids (advanced.database.generateId=false) so Prisma uuid defaults win', () => {
    // Our auth-table PKs are `@db.Uuid @default(uuid())`; better-auth must NOT
    // generate its own string ids, or the inserts would fight the schema default.
    expect(auth.options.advanced?.database?.generateId).toBe(false);
  });

  it('omits a social provider when no credentials are supplied for it', () => {
    const partial = createAuth(fakePrisma, {
      secret: 'x',
      sendMagicLink: async () => {},
      sendVerificationEmail: async () => {},
      sendResetPasswordEmail: async () => {},
      social: { google: { clientId: 'g', clientSecret: 's' } },
    });
    const social = partial.options.socialProviders ?? {};
    expect(social.google).toBeDefined();
    expect(social.microsoft).toBeUndefined();
    expect(social.apple).toBeUndefined();
  });
});
