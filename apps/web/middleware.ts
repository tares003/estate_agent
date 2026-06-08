import { NextResponse, type NextRequest } from 'next/server';

// Minimal EPIC-S tenant resolution. Full subdomain / custom-domain → platform.tenants
// lookup lands with EPIC-S; for now we pass through an explicit header or fall back
// to a dev tenant so tenant-scoped queries have a value downstream.
const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export function middleware(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  // TODO(EPIC-S): resolve by request hostname (subdomain / custom domain).
  const tenantId = request.headers.get('x-estate-tenant') ?? DEV_TENANT_ID;
  requestHeaders.set('x-estate-tenant', tenantId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
