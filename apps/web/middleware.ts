import { NextResponse, type NextRequest } from 'next/server';

// EPIC-S tenant resolution + EPIC-O URL canonicalisation.
//
// 1. Canonicalise public GET URLs (FR-O-2/3): lowercase, and no trailing slash
//    (except root). A non-canonical URL 301s to the canonical one so crawlers and
//    links converge on a single address. Only GET/HEAD are redirected — a 301 on
//    a POST (e.g. a Server Action) would drop the body — and `/api/*` is left
//    untouched.
// 2. Resolve the platform tenant (full subdomain / custom-domain lookup lands with
//    EPIC-S; for now an explicit header or a dev fallback) onto the request so
//    tenant-scoped queries downstream have a value.
const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/** The canonical form of a pathname: lowercase, trailing slash stripped (except root). */
export function canonicalPath(pathname: string): string {
  const lowered = pathname.toLowerCase();
  const trimmed = lowered.length > 1 ? lowered.replace(/\/+$/, '') : lowered;
  return trimmed === '' ? '/' : trimmed;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if ((method === 'GET' || method === 'HEAD') && !pathname.startsWith('/api/')) {
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
