import type { NextResponse } from 'next/server';

// EPIC-N FR-N-15 — the standard security headers emitted on every response.
//
// Applied from the proxy (which every request passes through) onto both the
// pass-through `NextResponse.next()` and the 301 canonicalisation redirect, so
// the baseline reaches every surface — public pages, the tenant/operator admin,
// the customer accounts, the portals and the API.
//
// The values are a single frozen table so there is exactly one source of truth;
// `applySecurityHeaders` writes them onto a given response in place. HSTS is also
// declared at the CDN edge (Cloudflare), but the origin asserts it too so the
// guarantee holds even on a direct-to-origin request.
//
//   Strict-Transport-Security  force HTTPS for 2y, all subdomains, preload-eligible.
//   X-Content-Type-Options     stop MIME-sniffing a response into an executable type.
//   X-Frame-Options            legacy clickjacking defence (DENY) for old browsers.
//   Content-Security-Policy     frame-ancestors 'none' — the modern clickjacking
//                               defence; kept minimal here (a full document CSP with
//                               nonces is a separate, larger slice).
//   Referrer-Policy            send only the origin cross-site; never leak the path.
//   Permissions-Policy         deny the powerful browser features the platform
//                               never uses, so a future XSS cannot reach for them.

/** The FR-N-15 security-header baseline: header name → value. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
});

/**
 * Write the FR-N-15 security headers onto a response, in place.
 *
 * Returns the same response instance so callers can `return
 * applySecurityHeaders(NextResponse.next())`. Existing response headers (e.g.
 * the proxy's forwarded-request overrides) are left untouched.
 *
 * @param response - the NextResponse the proxy is about to return.
 * @returns the same response, now carrying every security header.
 */
export function applySecurityHeaders<T extends NextResponse>(response: T): T {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
