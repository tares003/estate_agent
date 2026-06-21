import { describe, expect, it } from 'vitest';

import { magicLinkNotification } from './magic-link.js';

// B78b — the pure mapping from a Better Auth magic-link callback to a queued
// per-tenant email (the outbox row the EPIC-U worker renders with the
// `auth.magic_link` template). The orchestration (resolve tenant → withTenant →
// notify) is glue in auth.ts; this is the part worth locking down.

const TENANT = '11111111-1111-1111-1111-111111111111';

describe('magicLinkNotification', () => {
  it('queues an auth.magic_link email for the tenant carrying the verification url', () => {
    const input = magicLinkNotification(
      'vendor@example.com',
      'https://acme.test/api/auth/magic-link/verify?token=abc.def',
      TENANT,
    );
    expect(input).toEqual({
      tenantId: TENANT,
      event: 'auth.magic_link',
      channel: 'email',
      recipient: 'vendor@example.com',
      payload: { url: 'https://acme.test/api/auth/magic-link/verify?token=abc.def' },
    });
  });

  it('uses the email channel and the worker-registered event name verbatim', () => {
    const input = magicLinkNotification('a@b.com', 'https://x/y', TENANT);
    // These two strings are the contract with apps/workers notification-templates.
    expect(input.channel).toBe('email');
    expect(input.event).toBe('auth.magic_link');
  });
});
