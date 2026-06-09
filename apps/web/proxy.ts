import { NextResponse, type NextRequest } from 'next/server';

// EPIC-S tenant resolution + EPIC-O URL canonicalisation, in Next 16's `proxy`
// convention (formerly `middleware`).
//
// 1. Canonicalise public GET URLs (FR-O-2/3): lowercase, and no trailing slash
//    (except root). A non-canonical URL 301s to the canonical one so crawlers and
//    links converge on a single address. Only GET/HEAD are redirected (a 301 on a
//    POST/Server Action would drop the body); `/api/*` and the Payload CMS surface
//    (`/admin/cms`) are left untouched — both own case- and slash-sensitive URLs a
//    SEO redirect would break (the CMS admin SPA + its API under /admin/cms/api).
// 2. Resolve the platform tenant SERVER-SIDE and stamp it onto the request so
//    tenant-scoped queries downstream have a trustworthy value. SECURITY: the
//    tenant is NEVER taken from the inbound `x-estate-tenant` header — that is
//    client-supplied and forgeable, and downstream privileged reads (getMenu /
//    getPublishedPage) scope on it, so honouring a forged value would leak another
//    tenant's content. Full hostname (subdomain / custom-domain) resolution lands
//    with EPIC-S; until then every request resolves to the dev tenant.
export const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/** The header carrying the resolved tenant id to Server Components / actions. */
export const TENANT_HEADER = 'x-estate-tenant';
/** The header exposing the request path so server components can mark the active nav link. */
export const PATHNAME_HEADER = 'x-estate-pathname';

/**
 * Resolve the platform tenant for a request. Authoritative + server-side: it does
 * NOT read the inbound header (forgeable). TODO(EPIC-S): subdomain / custom-domain
 * hostname lookup; for now every request is the dev tenant.
 */
export function resolveTenantId(_request: NextRequest): string {
  return DEV_TENANT_ID;
}

/** Path prefixes that own their own URL shape and must skip SEO canonicalisation. */
function ownsItsOwnUrls(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/admin/cms');
}

/** The canonical form of a pathname: lowercase, trailing slash stripped (except root). */
export function canonicalPath(pathname: string): string {
  const lowered = pathname.toLowerCase();
  const trimmed = lowered.length > 1 ? lowered.replace(/\/+$/, '') : lowered;
  return trimmed === '' ? '/' : trimmed;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if ((method === 'GET' || method === 'HEAD') && !ownsItsOwnUrls(pathname)) {
    const canonical = canonicalPath(pathname);
    if (canonical !== pathname) {
      const url = new URL(request.url);
      url.pathname = canonical;
      return NextResponse.redirect(url, 301);
    }
  }

  const requestHeaders = new Headers(request.headers);
  // `set` overwrites any client-supplied value — a forged inbound tenant header is
  // never honoured (see resolveTenantId).
  requestHeaders.set(TENANT_HEADER, resolveTenantId(request));
  requestHeaders.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
