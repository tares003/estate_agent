// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import { SECURITY_HEADERS, applySecurityHeaders } from './security-headers.js';

// EPIC-N FR-N-15 — standard security headers must be emitted on every response:
// HSTS, X-Content-Type-Options, X-Frame-Options, CSP frame-ancestors,
// Referrer-Policy, Permissions-Policy. The header values live in one frozen
// table so the proxy (pass-through + redirect) and any future surface apply the
// identical baseline.

describe('SECURITY_HEADERS table (FR-N-15)', () => {
  it('defines HSTS with a long max-age, subdomains and preload', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'];
    // >= 1 year (the HSTS-preload minimum) so a single header earns preload eligibility.
    expect(hsts).toMatch(/max-age=(\d+)/);
    const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? '')?.[1] ?? '0');
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('denies framing via X-Frame-Options DENY', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it("sets a CSP whose frame-ancestors is 'none' (the modern X-Frame-Options)", () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('sets a privacy-preserving Referrer-Policy', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('locks down powerful features via Permissions-Policy', () => {
    const pp = SECURITY_HEADERS['Permissions-Policy'];
    // Disable the high-risk features the platform does not use.
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });
});

describe('applySecurityHeaders (FR-N-15)', () => {
  it('writes every security header onto a pass-through response', () => {
    const res = applySecurityHeaders(NextResponse.next());
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it('writes every security header onto a redirect response (body-less 301)', () => {
    const res = applySecurityHeaders(NextResponse.redirect(new URL('https://acme.test/x'), 301));
    expect(res.status).toBe(301);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it('returns the same response instance it was given (mutates in place)', () => {
    const original = NextResponse.next();
    expect(applySecurityHeaders(original)).toBe(original);
  });

  it('does not clobber headers the response already set', () => {
    const res = NextResponse.next();
    res.headers.set('x-estate-pathname', '/properties');
    applySecurityHeaders(res);
    expect(res.headers.get('x-estate-pathname')).toBe('/properties');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
