import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cloudflareVerifier,
  getTurnstileVerifier,
  verifyTurnstile,
  type TurnstileVerifier,
} from './turnstile.js';

/** Build a fake fetch returning a given ok/json, recording the last call. */
function fakeFetch(result: { ok: boolean; json?: unknown }) {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  const impl = vi.fn(async (url: string, init: { method: string; body: URLSearchParams }) => {
    calls.push({ url, body: init.body });
    return {
      ok: result.ok,
      json: async () => result.json ?? {},
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('cloudflareVerifier', () => {
  it('returns true when Cloudflare reports success and sends the secret + token + ip', async () => {
    const { impl, calls } = fakeFetch({ ok: true, json: { success: true } });
    const verifier = cloudflareVerifier('secret-xyz', impl);

    expect(await verifier.verify('tok-1', '203.0.113.7')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.get('secret')).toBe('secret-xyz');
    expect(calls[0]?.body.get('response')).toBe('tok-1');
    expect(calls[0]?.body.get('remoteip')).toBe('203.0.113.7');
  });

  it('omits remoteip when the client IP is unknown', async () => {
    const { impl, calls } = fakeFetch({ ok: true, json: { success: true } });
    await cloudflareVerifier('s', impl).verify('tok', null);
    expect(calls[0]?.body.has('remoteip')).toBe(false);
  });

  it('returns false when Cloudflare reports failure', async () => {
    const { impl } = fakeFetch({ ok: true, json: { success: false } });
    expect(await cloudflareVerifier('s', impl).verify('tok', null)).toBe(false);
  });

  it('fails closed on a non-2xx response', async () => {
    const { impl } = fakeFetch({ ok: false });
    expect(await cloudflareVerifier('s', impl).verify('tok', null)).toBe(false);
  });

  it('fails closed on a network error', async () => {
    const impl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await cloudflareVerifier('s', impl).verify('tok', null)).toBe(false);
  });

  it('rejects an empty token without calling Cloudflare', async () => {
    const { impl, calls } = fakeFetch({ ok: true, json: { success: true } });
    expect(await cloudflareVerifier('s', impl).verify(null, null)).toBe(false);
    expect(await cloudflareVerifier('s', impl).verify('', null)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('getTurnstileVerifier (env resolution)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the Cloudflare verifier when a secret is configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'operator-secret');
    // An empty token short-circuits to false without network — proves it is the
    // real (cloudflare) verifier, not the always-allow dev stub.
    expect(await getTurnstileVerifier().verify('', null)).toBe(false);
  });

  it('allows (dev ergonomics) when no secret and not production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(await getTurnstileVerifier().verify(null, null)).toBe(true);
  });

  it('fails closed (deny) when no secret and production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await getTurnstileVerifier().verify('anything', null)).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  it('delegates to the injected verifier', async () => {
    const pass: TurnstileVerifier = { verify: async () => true };
    const fail: TurnstileVerifier = { verify: async () => false };
    expect(await verifyTurnstile('tok', '1.2.3.4', pass)).toBe(true);
    expect(await verifyTurnstile('tok', '1.2.3.4', fail)).toBe(false);
  });
});
