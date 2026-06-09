/**
 * Cloudflare Turnstile server-side verification (CLAUDE.md §9 — the anti-spam /
 * challenge-response layer; "token captured client-side, verified server-side on
 * every form submission"). Cloudflare is the declared anti-spam sub-processor
 * (docs/sub-processors.json).
 *
 * KEY OWNERSHIP — OPERATOR-LEVEL. Turnstile keys are configured per-deployment
 * via env, NOT per tenant: Cloudflare is operator infrastructure here (it also
 * fronts the origin as the CDN, CLAUDE.md §9), so one operator Turnstile widget
 * (with the platform's domains allow-listed) protects every tenant surface.
 *   - NEXT_PUBLIC_TURNSTILE_SITE_KEY — the public sitekey the widget renders with
 *     (client side; read by the form).
 *   - TURNSTILE_SECRET_KEY — the secret used here for server-side siteverify.
 * (A tenant wanting their own Cloudflare account can be moved to a per-tenant key
 * later behind this same interface, mirroring the per-tenant Maps key pattern.)
 *
 * The verifier is an interface so Server Actions stay testable without the
 * network; the default reads the operator secret from env.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Verifies a Turnstile token. Injectable so form actions test without the network. */
export interface TurnstileVerifier {
  verify(token: string | null, remoteIp: string | null): Promise<boolean>;
}

/** The slice of Cloudflare's siteverify JSON response we rely on. */
interface SiteverifyResponse {
  success?: boolean;
}

/**
 * The production verifier — POSTs the token (and client IP, when known) to
 * Cloudflare's siteverify endpoint with the operator secret. Fails CLOSED:
 * an empty token, a non-2xx response, malformed JSON, or a network error all
 * yield `false`. `fetchImpl` is injectable for tests.
 */
export function cloudflareVerifier(
  secret: string,
  fetchImpl: typeof fetch = fetch,
): TurnstileVerifier {
  return {
    async verify(token, remoteIp) {
      if (!token) return false;
      const body = new URLSearchParams({ secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      try {
        const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
        if (!response.ok) return false;
        const data = (await response.json()) as SiteverifyResponse;
        return data.success === true;
      } catch {
        return false;
      }
    },
  };
}

/** Always passes — used in non-production when no secret is configured (dev ergonomics). */
const ALLOW: TurnstileVerifier = { verify: async () => true };
/** Always fails — used in production when the secret is missing (fail closed). */
const DENY: TurnstileVerifier = { verify: async () => false };

/**
 * Resolve the active verifier from env. With a secret: the real Cloudflare
 * verifier. Without one: ALLOW in non-production (so local dev / tests work
 * without Turnstile configured) and DENY in production (a missing secret must
 * never silently disable the anti-spam gate).
 */
export function getTurnstileVerifier(): TurnstileVerifier {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret) return cloudflareVerifier(secret);
  return process.env.NODE_ENV === 'production' ? DENY : ALLOW;
}

/**
 * Verify a Turnstile token server-side. Returns true iff the challenge passed.
 * The verifier defaults to the env-resolved one; pass an explicit verifier in
 * tests. Reusable by every public form action (enquiry, viewing, valuation,
 * repair) — the shared anti-spam gate.
 */
export async function verifyTurnstile(
  token: string | null,
  remoteIp: string | null,
  verifier: TurnstileVerifier = getTurnstileVerifier(),
): Promise<boolean> {
  return verifier.verify(token, remoteIp);
}
