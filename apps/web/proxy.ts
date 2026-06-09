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
// 2. Resolve the platform tenant (full subdomain / custom-domain lookup lands with
//    EPIC-S; for now an explicit header or a dev fallback) onto the request so
//    tenant-scoped queries downstream have a value.
const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

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

  // TODO(EPIC-S): resolve by request hostname (subdomain / custom domain).
  const requestHeaders = new Headers(request.headers);
  const tenantId = request.headers.get('x-estate-tenant') ?? DEV_TENANT_ID;
  requestHeaders.set('x-estate-tenant', tenantId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
