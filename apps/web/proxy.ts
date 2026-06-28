import { NextResponse, type NextRequest } from 'next/server';

import { getDb } from './app/(app)/lib/db.js';
import { bumpRedirectHit, consultRedirect } from './redirect-consult.js';
import { applySecurityHeaders } from './security-headers.js';
import { createTenantRegistry, resolveTenantIdByHost } from './tenant-host.js';

// EPIC-S tenant resolution + EPIC-O URL canonicalisation, in Next 16's `proxy`
// convention (which always runs on the Node.js runtime — so the per-request
// tenant lookup can use Prisma).
//
// 1. Canonicalise public GET URLs (FR-O-2/3): lowercase, no trailing slash
//    (except root). `/api/*` and `/admin/cms` own their URLs and are skipped.
// 2. Resolve the platform tenant from the request HOSTNAME (FR-S-1): the
//    `<slug>.<base>` subdomain or a custom domain → the active tenant id, cached.
//    SECURITY: the inbound `x-estate-tenant` header is always stripped and never
//    trusted; only a server-resolved value is set (downstream privileged reads
//    scope on it). Unknown/suspended hosts resolve to no tenant (fail closed);
//    in dev, non-tenant hosts fall back to the dev tenant.
export const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const TENANT_HEADER = 'x-estate-tenant';
export const PATHNAME_HEADER = 'x-estate-pathname';

/** Platform base domain; the dev default keeps `localhost` an apex (→ dev tenant). */
const BASE_DOMAIN = process.env['PLATFORM_BASE_DOMAIN'] ?? 'localhost';
/** Fall back to the dev tenant for non-tenant hosts outside production. */
const DEV_FALLBACK = process.env['NODE_ENV'] !== 'production';
const CACHE_TTL_MS = 60_000;

/** Per-host resolution cache (the proxy runs on every request; one long-lived process). */
const tenantCache = new Map<string, { id: string | null; expires: number }>();

function requestHost(request: NextRequest): string {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
}

/** Resolve a host to its active tenant id (cached); null for apex/operator/unknown. */
async function resolveTenant(host: string): Promise<string | null> {
  const now = Date.now();
  const cached = tenantCache.get(host);
  if (cached && cached.expires > now) {
    return cached.id;
  }
  const id = await resolveTenantIdByHost(host, BASE_DOMAIN, createTenantRegistry(getDb()));
  tenantCache.set(host, { id, expires: now + CACHE_TTL_MS });
  return id;
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

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if ((method === 'GET' || method === 'HEAD') && !ownsItsOwnUrls(pathname)) {
    const canonical = canonicalPath(pathname);
    if (canonical !== pathname) {
      const url = new URL(request.url);
      url.pathname = canonical;
      // FR-N-15: the redirect is a response too — it carries the headers.
      return applySecurityHeaders(NextResponse.redirect(url, 301));
    }
  }

  const requestHeaders = new Headers(request.headers);
  // Never trust a client-supplied tenant header — strip it, set only the resolved value.
  requestHeaders.delete(TENANT_HEADER);
  const resolved =
    (await resolveTenant(requestHost(request))) ?? (DEV_FALLBACK ? DEV_TENANT_ID : null);
  if (resolved) {
    requestHeaders.set(TENANT_HEADER, resolved);
  }
  requestHeaders.set(PATHNAME_HEADER, pathname);

  // FR-O-11: BEFORE the normal pass-through, consult the tenant's managed redirect
  // rules for this exact (canonical) path. A match emits a 301/302/307 (or 410 gone).
  // FAIL-OPEN: consultRedirect swallows its own errors and returns null on failure, so
  // a redirect-lookup error can never break the request — we fall through to the
  // pass-through below. Only public GET/HEAD paths are consulted (the API + CMS own
  // their URLs; mutating methods must not be turned into a body-dropping redirect).
  if (resolved && (method === 'GET' || method === 'HEAD') && !ownsItsOwnUrls(pathname)) {
    const match = await consultRedirect(getDb(), resolved, pathname);
    if (match) {
      // Best-effort hit bump — fire-and-forget; never block or break the redirect.
      void bumpRedirectHit(getDb(), resolved, match.id);
      if (match.status === 410) {
        // A `gone` rule serves no destination — a 410, not a location redirect.
        return applySecurityHeaders(new NextResponse(null, { status: 410 }));
      }
      const target = new URL(match.destinationPath, request.url);
      // FR-N-15: the redirect is a response too — it carries the headers.
      return applySecurityHeaders(NextResponse.redirect(target, match.status));
    }
  }

  // FR-N-15: emit the standard security headers on every pass-through response.
  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
