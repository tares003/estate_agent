// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { canonicalPath, proxy } from './proxy.js';

function get(url: string, method = 'GET'): NextRequest {
  return new NextRequest(new URL(url), { method });
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
  it('301-redirects an uppercase path to lowercase', () => {
    const res = proxy(get('https://acme.test/Properties/Palatine-Road'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://acme.test/properties/palatine-road');
  });

  it('301-redirects a trailing-slash path to the slash-less canonical, preserving the query', () => {
    const res = proxy(get('https://acme.test/properties/?saleType=rent'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://acme.test/properties?saleType=rent');
  });

  it('does not redirect an already-canonical path (passes through)', () => {
    const res = proxy(get('https://acme.test/properties'));
    expect(res.status).not.toBe(301);
    expect(res.headers.get('location')).toBeNull();
  });

  it('leaves the root path alone', () => {
    const res = proxy(get('https://acme.test/'));
    expect(res.status).not.toBe(301);
  });

  it('never redirects a non-GET request (a 301 would drop the body)', () => {
    const res = proxy(get('https://acme.test/Properties/Palatine-Road', 'POST'));
    expect(res.status).not.toBe(301);
  });

  it('leaves /api/* paths untouched (no SEO redirect on the API surface)', () => {
    const res = proxy(get('https://acme.test/api/Webhook'));
    expect(res.status).not.toBe(301);
  });

  it('leaves the Payload CMS surface (/admin/cms) untouched — it owns its own URLs', () => {
    // Payload routes are case- and trailing-slash-sensitive; a SEO 301 would break
    // admin navigation and the CMS API under /admin/cms/api.
    const mixedCase = proxy(get('https://acme.test/admin/cms/Collections/Pages'));
    expect(mixedCase.status).not.toBe(301);

    const trailingSlash = proxy(get('https://acme.test/admin/cms/api/pages/'));
    expect(trailingSlash.status).not.toBe(301);
  });
});

describe('proxy tenant resolution (EPIC-S)', () => {
  it('passes an explicit tenant header through unchanged', () => {
    const req = new NextRequest(new URL('https://acme.test/properties'), {
      headers: { 'x-estate-tenant': '99999999-9999-9999-9999-999999999999' },
    });
    const res = proxy(req);
    expect(res.status).not.toBe(301);
    // a pass-through (NextResponse.next) is not a redirect
    expect(res.headers.get('location')).toBeNull();
  });
});
