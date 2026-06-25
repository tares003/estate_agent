import { describe, expect, it, vi } from 'vitest';

// B78c — the Better Auth catch-all route. The configured path (auth.handler against
// a live DB) is covered by the Testcontainers integration tests (B78e); here we
// lock the SAFETY property: when Better Auth is not configured (no
// BETTER_AUTH_SECRET → getAuth() returns null) the endpoint 404s and never touches
// a DB, so the running app is unchanged. getAuth is mocked to null so the test
// stays free of better-auth / Prisma construction.
vi.mock('../../../lib/auth.js', () => ({ getAuth: () => null }));

import { GET, POST } from './route.js';

describe('Better Auth route mount', () => {
  it('exposes GET and POST handlers', () => {
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('404s when Better Auth is unconfigured — fail-soft, no DB touched', async () => {
    const res = await GET(new Request('http://acme.test/api/auth/get-session'));
    expect(res.status).toBe(404);
    const post = await POST(
      new Request('http://acme.test/api/auth/sign-in/email', { method: 'POST' }),
    );
    expect(post.status).toBe(404);
  });
});
