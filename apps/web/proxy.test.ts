// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The proxy resolves the tenant via Prisma at request time; mock getDb so no real
// DB is touched. findFirst returns the configured row (by the `where` it is given).
const findFirst = vi.fn<
  (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>
>(async () => null);
vi.mock('./app/(app)/lib/db.js', () => ({
  getDb: () => ({ platformTenant: { findFirst } }),
}));

// The redirect consult (FR-O-11) is unit-tested in redirect-consult.test.ts; here we
// mock it so the proxy's wiring (consult → emit redirect / fall through) is the unit
// under test. `consultRedirect` defaults to no-match; a test overrides it per case.
const consultRedirect = vi.fn<
  () => Promise<{ id: string; destinationPath: string; status: number } | null>
>(async () => null);
const bumpRedirectHit = vi.fn(async () => undefined);
vi.mock('./redirect-consult.js', () => ({
  consultRedirect: (...a: unknown[]) => consultRedirect(...(a as [])),
  bumpRedirectHit: (...a: unknown[]) => bumpRedirectHit(...(a as [])),
}));

const { DEV_TENANT_ID, TENANT_HEADER, PATHNAME_HEADER, canonicalPath, proxy } =
  await import('./proxy.js');

function get(url: string, method = 'GET', headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url), headers ? { method, headers } : { method });
}

/** The value the proxy forwarded for a request header (NextResponse.next override). */
function forwarded(res: Awaited<ReturnType<typeof proxy>>, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe('canonicalPath', () => {
  it('lowercases and strips a trailing slash, keeping root', () => {
    expect(canonicalPath('/Properties/Palatine-Road')).toBe('/properties/palatine-road');
    expect(canonicalPath('/properties/')).toBe('/properties');
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('/properties')).toBe('/properties');
  });
});

describe('proxy URL canonicalisation (FR-O-2/3)', () => {
  it('301-redirects an uppercase path to lowercase', async () => {
    const res = await proxy(get('https://acme.test/Properties/Palatine-Road'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://acme.test/properties/palatine-road');
  });

  it('301-redirects a trailing-slash path to the slash-less canonical, preserving the query', async () => {
    const res = await proxy(get('https://acme.test/properties/?saleType=rent'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://acme.test/properties?saleType=rent');
  });

  it('does not redirect an already-canonical path (passes through)', async () => {
    const res = await proxy(get('https://acme.test/properties'));
    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
  });

  it('leaves the root path alone', async () => {
    const res = await proxy(get('https://acme.test/'));
    expect(res.status).not.toBe(301);
  });

  it('never redirects a non-GET request (a 301 would drop the body)', async () => {
    const res = await proxy(get('https://acme.test/Properties/Palatine-Road', 'POST'));
    expect(res.status).not.toBe(301);
  });

  it('leaves /api/* paths untouched (no SEO redirect on the API surface)', async () => {
    const res = await proxy(get('https://acme.test/api/Webhook'));
    expect(res.status).not.toBe(301);
  });

  it('leaves the Payload CMS surface (/admin/cms) untouched — it owns its own URLs', async () => {
    const mixedCase = await proxy(get('https://acme.test/admin/cms/Collections/Pages'));
    expect(mixedCase.status).not.toBe(301);
    const trailingSlash = await proxy(get('https://acme.test/admin/cms/api/pages/'));
    expect(trailingSlash.status).not.toBe(301);
  });
});

describe('proxy security headers (EPIC-N FR-N-15)', () => {
  it('emits the standard security headers on a pass-through response', async () => {
    const res = await proxy(get('https://acme.test/properties'));
    expect(res.status).not.toBe(301);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toContain('geolocation=()');
  });

  it('emits the standard security headers on a 301 canonicalisation redirect', async () => {
    const res = await proxy(get('https://acme.test/Properties/Palatine-Road'));
    expect(res.status).toBe(301);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe('proxy tenant resolution (EPIC-S FR-S-1)', () => {
  it('forwards the host-resolved tenant and strips any forged inbound header', async () => {
    findFirst.mockImplementation(async ({ where }) =>
      where['customDomain'] === 'resolved-tenant.example' ? { id: 'tenant-acme' } : null,
    );
    const res = await proxy(
      // localhost base in tests → this custom domain triggers a registry lookup.
      // A fresh host avoids the module-level resolution cache from earlier tests.
      get('https://resolved-tenant.example/properties', 'GET', {
        host: 'resolved-tenant.example',
        'x-estate-tenant': '99999999-9999-9999-9999-999999999999',
      }),
    );
    expect(forwarded(res, TENANT_HEADER)).toBe('tenant-acme');
    expect(forwarded(res, TENANT_HEADER)).not.toBe('99999999-9999-9999-9999-999999999999');
  });

  it('falls back to the dev tenant for a non-tenant host (localhost apex) without a DB query', async () => {
    findFirst.mockClear();
    const res = await proxy(get('http://localhost:3000/properties'));
    expect(forwarded(res, TENANT_HEADER)).toBe(DEV_TENANT_ID);
    expect(findFirst).not.toHaveBeenCalled(); // apex short-circuits before the registry
  });

  it('exposes the request path for active-nav matching', async () => {
    const res = await proxy(get('http://localhost:3000/properties'));
    expect(forwarded(res, PATHNAME_HEADER)).toBe('/properties');
  });
});

describe('proxy managed redirects (EPIC-O FR-O-11)', () => {
  it('emits a 301 to the rule destination when a redirect matches', async () => {
    consultRedirect.mockResolvedValueOnce({ id: 'r1', destinationPath: '/new-path', status: 301 });
    const res = await proxy(get('http://localhost:3000/old-path'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('http://localhost:3000/new-path');
  });

  it('honours the rule status (302 found)', async () => {
    consultRedirect.mockResolvedValueOnce({ id: 'r2', destinationPath: '/elsewhere', status: 302 });
    const res = await proxy(get('http://localhost:3000/temp'));
    expect(res.status).toBe(302);
  });

  it('serves a 410 (no location) for a `gone` rule', async () => {
    consultRedirect.mockResolvedValueOnce({ id: 'r3', destinationPath: '', status: 410 });
    const res = await proxy(get('http://localhost:3000/retired'));
    expect(res.status).toBe(410);
    expect(res.headers.get('location')).toBeNull();
  });

  it('best-effort bumps the hit counter on a match', async () => {
    bumpRedirectHit.mockClear();
    consultRedirect.mockResolvedValueOnce({ id: 'r1', destinationPath: '/new-path', status: 301 });
    await proxy(get('http://localhost:3000/old-path'));
    expect(bumpRedirectHit).toHaveBeenCalledTimes(1);
  });

  it('falls through to the pass-through when no rule matches', async () => {
    consultRedirect.mockResolvedValueOnce(null);
    const res = await proxy(get('http://localhost:3000/properties'));
    expect(res.status).not.toBe(301);
    expect(forwarded(res, PATHNAME_HEADER)).toBe('/properties');
  });

  it('carries the FR-N-15 security headers on a redirect-rule response', async () => {
    consultRedirect.mockResolvedValueOnce({ id: 'r1', destinationPath: '/new-path', status: 301 });
    const res = await proxy(get('http://localhost:3000/old-path'));
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('never consults a redirect for a non-GET request', async () => {
    consultRedirect.mockClear();
    await proxy(get('http://localhost:3000/old-path', 'POST'));
    expect(consultRedirect).not.toHaveBeenCalled();
  });

  it('never consults a redirect on the API surface', async () => {
    consultRedirect.mockClear();
    await proxy(get('http://localhost:3000/api/old-path'));
    expect(consultRedirect).not.toHaveBeenCalled();
  });
});
